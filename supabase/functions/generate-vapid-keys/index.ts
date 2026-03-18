import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate VAPID key pair using Web Crypto API
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKey)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return new Response(JSON.stringify({
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64,
    message: 'Add these as Supabase secrets: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
