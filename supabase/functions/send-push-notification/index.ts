import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

async function createJWT(subject: string, audience: string, privateKeyBytes: Uint8Array): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: subject, sub: subject, aud: audience, exp: now + 12 * 3600, iat: now };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8', privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const derSig = new Uint8Array(signatureBuffer);
  let rawSig: Uint8Array;
  
  if (derSig.length === 64) {
    rawSig = derSig;
  } else {
    // Parse DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
    let offset = 2; // skip 0x30 <totalLen>
    offset += 1; // 0x02
    const rLen = derSig[offset++];
    const r = derSig.slice(offset, offset + rLen);
    offset += rLen;
    offset += 1; // 0x02
    const sLen = derSig[offset++];
    const s = derSig.slice(offset, offset + sLen);
    
    rawSig = new Uint8Array(64);
    // Pad/trim r to 32 bytes
    if (r.length <= 32) {
      rawSig.set(r, 32 - r.length);
    } else {
      rawSig.set(r.slice(r.length - 32), 0);
    }
    // Pad/trim s to 32 bytes
    if (s.length <= 32) {
      rawSig.set(s, 64 - s.length);
    } else {
      rawSig.set(s.slice(s.length - 32), 32);
    }
  }

  return `${signingInput}.${base64urlEncode(rawSig)}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<boolean> {
  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await createJWT(vapidSubject, audience, privateKeyBytes);

  // Encrypt payload using Web Push encryption (aesgcm)
  const authBytes = base64urlDecode(subscription.auth);
  const p256dhBytes = base64urlDecode(subscription.p256dh);

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', p256dhBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey, 256
  ));

  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  // PRK = HKDF-Extract(auth, sharedSecret)
  const authHkdfKey = await crypto.subtle.importKey('raw', authBytes, { name: 'HKDF' }, false, ['deriveBits']);
  // Actually for Web Push aesgcm: PRK = HMAC-SHA-256(auth, ECDH)
  // Step 1: auth_info = "Content-Encoding: auth\0"
  // IKM via HKDF(salt=auth, ikm=ecdh_secret, info="Content-Encoding: auth\0", len=32)
  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBytes, info: encoder.encode('Content-Encoding: auth\0') },
    ikmKey, 256
  ));

  // context = label || 0x00 || client_pub_len(2) || client_pub || server_pub_len(2) || server_pub
  const label = encoder.encode('P-256');
  const context = new Uint8Array(label.length + 1 + 2 + p256dhBytes.length + 2 + serverPublicKeyRaw.length);
  let pos = 0;
  context.set(label, pos); pos += label.length;
  context[pos++] = 0;
  context[pos++] = 0; context[pos++] = p256dhBytes.length;
  context.set(p256dhBytes, pos); pos += p256dhBytes.length;
  context[pos++] = 0; context[pos++] = serverPublicKeyRaw.length;
  context.set(serverPublicKeyRaw, pos);

  // cek_info = "Content-Encoding: aesgcm\0" + context
  const cekInfoPrefix = encoder.encode('Content-Encoding: aesgcm\0');
  const cekInfo = new Uint8Array(cekInfoPrefix.length + context.length);
  cekInfo.set(cekInfoPrefix); cekInfo.set(context, cekInfoPrefix.length);

  // nonce_info = "Content-Encoding: nonce\0" + context
  const nonceInfoPrefix = encoder.encode('Content-Encoding: nonce\0');
  const nonceInfo = new Uint8Array(nonceInfoPrefix.length + context.length);
  nonceInfo.set(nonceInfoPrefix); nonceInfo.set(context, nonceInfoPrefix.length);

  const ikmForDerive = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);

  const cekBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    ikmForDerive, 128
  ));

  const nonceBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    ikmForDerive, 96
  ));

  const aesKey = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']);

  // Pad payload: 2-byte big-endian padding length (0) + payload
  const payloadBytes = encoder.encode(payload);
  const paddedPayload = new Uint8Array(2 + payloadBytes.length);
  // First 2 bytes = 0 (no padding)
  paddedPayload.set(payloadBytes, 2);

  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBits },
    aesKey, paddedPayload
  ));

  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${base64urlEncode(salt)}`,
      'Crypto-Key': `dh=${base64urlEncode(serverPublicKeyRaw)};p256ecdsa=${vapidPublicKey}`,
      'TTL': '86400',
    },
    body: encrypted,
  });

  console.log('Push response:', resp.status, subscription.endpoint.substring(0, 60));
  
  if (resp.status === 410 || resp.status === 404) {
    // Subscription expired
    return false;
  }
  
  return resp.status >= 200 && resp.status < 300;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:info@fuik.co';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { user_id, title, message, url, notify_all_managers } = await req.json();

    // Get subscriptions
    let query = supabase.from('push_subscriptions').select('*');
    if (notify_all_managers) {
      const { data: managerIds } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'management', 'director', 'right_hand']);
      const ids = (managerIds || []).map((m: any) => m.user_id);
      if (ids.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: 'No manager subscriptions found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      query = query.in('user_id', ids);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data: subscriptions } = await query;
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/intake/conversations',
      icon: '/icons/icon-192.png',
    });

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subscriptions) {
      try {
        const success = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload, vapidPublicKey, vapidPrivateKey, vapidSubject
        );
        if (success) sent++;
        else expired.push(sub.id);
      } catch (e) {
        console.error('Push failed for subscription:', sub.id, e);
        expired.push(sub.id);
      }
    }

    // Remove expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
      console.log(`Cleaned up ${expired.length} expired subscriptions`);
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length, cleaned: expired.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-push-notification error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
