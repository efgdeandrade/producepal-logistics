

# Update WhatsApp Access Token to Permanent Token

## What We're Doing

Replacing the temporary WhatsApp access token with your new permanent System User token to ensure Dre's proactive sales system stays operational indefinitely.

## Action Required

Update the `WHATSAPP_ACCESS_TOKEN` secret in Lovable Cloud with the permanent token you provided.

## What This Enables

Once updated, Dre will:
- Send proactive outreach messages at 6:30 AM, 9:00 AM, and 8:00 PM daily
- Never experience token expiration issues
- Continue tracking sales attribution and conversions

## Verification

After updating, we can test by:
1. Manually triggering the `dre-proactive-outreach` function
2. Checking the edge function logs for successful WhatsApp API calls
3. Confirming messages are delivered to test customers

## Token Details

- **Format**: Valid Meta System User token (starts with EAAP...)
- **Type**: Permanent (no expiration)
- **Permissions**: whatsapp_business_messaging, whatsapp_business_management

