

# Phase 1: WhatsApp Business API Connection

## Step 1: Add WhatsApp Secrets

Add these 4 secrets to your project:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `WHATSAPP_PHONE_NUMBER_ID` | `946073451923499` | Your WhatsApp Business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | `EAAPjXYl...` (your token) | API authentication |
| `WHATSAPP_APP_SECRET` | `d6eb5e78c59286c6f6b8fd480f459e78` | Webhook signature verification |
| `WHATSAPP_VERIFY_TOKEN` | `fuik_whatsapp_2024` | Webhook handshake verification |

## Step 2: Update whatsapp-webhook Edge Function

The current webhook already has verification logic, but we need to ensure it uses the correct secret name. Updates needed:

**File: `supabase/functions/whatsapp-webhook/index.ts`**

Current code already handles:
- GET requests for webhook verification (Meta's challenge)
- POST requests for incoming messages
- Signature verification with `WHATSAPP_APP_SECRET`

Minor update needed:
- Ensure `WHATSAPP_VERIFY_TOKEN` is used (currently uses `WHATSAPP_VERIFY_TOKEN` - correct!)
- The webhook is already well-structured

## Step 3: Configure Webhook in Meta Dashboard

After secrets are added and webhook is deployed, you'll configure in Meta:

1. Go to **WhatsApp → Configuration** in Meta dashboard
2. Click **Edit** on the Webhook section
3. Enter:
   - **Callback URL**: `https://dnxzpkbobzwjcuyfgdnh.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify token**: `fuik_whatsapp_2024`
4. Click **Verify and Save**
5. Subscribe to webhook fields:
   - `messages` (required - for incoming messages)
   - `message_status` (optional - for delivery receipts)

## Step 4: Test the Connection

After webhook is verified:
1. Send a test message from your personal WhatsApp to your Business number
2. Check edge function logs to confirm message received
3. Verify message stored in `whatsapp_messages` table

## What I'll Implement

1. **Add the 4 secrets** using the secrets tool
2. **Review and update** the whatsapp-webhook if any changes needed
3. **Deploy** the edge function
4. **Guide you** through the Meta dashboard webhook configuration

## Expected Outcome

After this phase:
- Your webhook will respond to Meta's verification challenge
- Incoming WhatsApp messages will be received and stored
- Foundation ready for Phase 2 (AI agent implementation)

