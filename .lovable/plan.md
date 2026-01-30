
# Comprehensive Dre WhatsApp System Overhaul

## Summary
A complete redesign of the Dre WhatsApp sales channel to fix critical order flow issues, add team notifications, and create a professional Stack-like inbox experience with proper timestamps, filtering, and escalation handling.

---

## Critical Bugs to Fix First

### 1. Webhook Failing for Reaction Messages
**Problem:** The `whatsapp_messages` table has a check constraint that only allows `text|image|document|order|template` message types. WhatsApp sends `reaction` type messages which cause database insert failures, breaking the webhook.

**Fix:** Update the database constraint to include additional WhatsApp message types:
- `reaction` - emoji reactions
- `audio` - voice messages
- `video` - video messages
- `location` - location shares
- `contact` - contact cards
- `sticker` - stickers

### 2. Orders Not Being Pushed to Distribution Orders
**Problem:** The AI agent tries to insert `customer_phone` into `distribution_orders` but this column doesn't exist. Orders are never created even when customers confirm.

**Fix:** 
- The `distribution_orders` table doesn't have `customer_phone` or `source` columns - need to add them
- Update the AI agent to use correct column names
- Add proper error handling and logging

### 3. Notification Badge Stuck at Wrong Number
**Problem:** `useWhatsAppUnreadCount` counts ALL inbound messages in last hour, not truly unread messages.

**Fix:** Implement proper read tracking:
- Add a `read_at` or `is_read` column to `whatsapp_messages`
- Count only messages that haven't been marked as read
- Mark messages as read when conversation is opened

---

## New Features to Add

### 4. Team Notification System
When any order is created via WhatsApp, immediately notify team members:

**Database:**
- Add `team_notification_phones` table or use existing `profiles.whatsapp_phone`
- Store which team roles get notified for what events

**Edge Function Changes:**
- After successful order creation, send WhatsApp to configured team members
- Include: customer name, order summary, delivery date, any special requests
- Add in-app push notification via `notifications` table

**Team Member Configuration:**
Create UI in Settings to add team members with:
- Name
- WhatsApp phone
- Role (logistics, management, sales)
- Notification preferences (new orders, escalations, complaints)

### 5. Delivery Time Handling
When customer requests specific delivery time ("before 2pm"):

**AI Agent Changes:**
- Detect time requests in the AI prompt
- Store requested time in order notes or new `requested_delivery_time` column
- For complex requests (e.g., "need it by 11am sharp"), escalate to logistics team

**Escalation Flow:**
- Send WhatsApp to logistics team member with time requirement
- Create in-app notification
- Flag the order as having special delivery requirements

---

## UI/UX Overhaul

### 6. Complete Inbox Redesign (Stack-like Interface)

**Conversation List Panel:**
- Group conversations by date (Today, Yesterday, This Week, Older)
- Show full timestamps with date
- Add filter chips: All | Unread | Pending Order | Escalated | Today's Orders
- Search with customer name, phone, and message content
- Visual indicators: unread dot, order status tag, escalation badge

**Message Thread View:**
- Date separators between different days
- Full timestamp on hover, relative time by default
- Clear visual distinction between:
  - Customer messages (left, gray)
  - Dre AI responses (right, green with robot icon)
  - Human team responses (right, blue with human icon)
- Typing indicator when Dre is processing
- Message status: sent, delivered, read (checkmarks)

**Context Sidebar:**
- Customer quick info card
- Order history for this customer
- Standing order status
- Notes section
- Quick action buttons

### 7. Real-time Indicators
- Show "Dre is typing..." when AI is processing
- Show green dot next to customers who are currently online
- Audio notification for new messages (configurable)
- Desktop push notification support

### 8. Date/Time Display Standards
- Messages: Show `HH:mm` with date in bubble header when date changes
- Conversation list: Show `HH:mm` for today, `Yesterday HH:mm`, or `MMM dd` for older
- Full date/time on hover: `Thursday, January 30, 2026 at 3:45 PM`

---

## Technical Implementation

### Database Changes

```sql
-- 1. Fix message type constraint
ALTER TABLE whatsapp_messages 
DROP CONSTRAINT whatsapp_messages_message_type_check;

ALTER TABLE whatsapp_messages 
ADD CONSTRAINT whatsapp_messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'document', 'order', 'template', 
                        'audio', 'video', 'location', 'contact', 'sticker', 'reaction'));

-- 2. Add missing columns to distribution_orders
ALTER TABLE distribution_orders 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS customer_phone text;

-- 3. Add read tracking to messages
ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS read_at timestamptz,
ADD COLUMN IF NOT EXISTS read_by uuid REFERENCES profiles(id);

-- 4. Add delivery time request tracking
ALTER TABLE distribution_orders 
ADD COLUMN IF NOT EXISTS requested_delivery_time text,
ADD COLUMN IF NOT EXISTS has_special_requirements boolean DEFAULT false;

-- 5. Team notification config table
CREATE TABLE IF NOT EXISTS team_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  whatsapp_phone text NOT NULL,
  notify_on_new_orders boolean DEFAULT true,
  notify_on_escalations boolean DEFAULT true,
  notify_on_complaints boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Edge Function Changes

**whatsapp-webhook/index.ts:**
- Handle all message types gracefully
- Skip storing reaction/sticker messages (acknowledge but don't insert)
- Better error handling with fallback

**whatsapp-ai-agent/index.ts:**
- Fix order creation with correct column names
- Extract delivery time requests from AI response
- After order creation, call new team notification function
- Store detected special requirements

**New: notify-team-order/index.ts:**
- Accept order details
- Query team_notification_settings for recipients
- Send WhatsApp to each configured team member
- Create in-app notifications

### Frontend Components

**New/Modified Files:**
| File | Purpose |
|------|---------|
| `src/pages/fnb/FnbDreInbox.tsx` | Complete rewrite of main inbox |
| `src/components/dre/InboxConversationList.tsx` | Grouped list with filters |
| `src/components/dre/InboxMessageThread.tsx` | Rich message view with dates |
| `src/components/dre/InboxSidebar.tsx` | Customer context panel |
| `src/components/dre/DateSeparator.tsx` | Visual date dividers |
| `src/hooks/useDreInbox.ts` | Consolidated data hook |
| `src/hooks/useMessageRead.ts` | Read tracking hook |
| `src/pages/fnb/FnbSettings.tsx` | Add team notification config |

---

## User Flow Improvements

### Order Flow (After Fix):
1. Customer sends order via WhatsApp
2. Dre AI parses and confirms items
3. Customer confirms "Si" or "Yes"
4. Order created in `distribution_orders`
5. Team members receive WhatsApp notification instantly
6. Order appears in Dashboard Kanban
7. In-app notification shown to all sales staff

### Special Request Flow:
1. Customer: "Need delivery before 2pm please"
2. Dre: "Got it! I'll make sure the team knows you need it by 2pm."
3. Order created with `requested_delivery_time = '14:00'`
4. Team notification includes: "SPECIAL: Delivery before 2pm"
5. Logistics team sees flag in order details

### Escalation Flow:
1. Customer asks complex question or sounds frustrated
2. Dre detects mood and sends escalation to team
3. Team member gets WhatsApp + in-app notification
4. They can take over conversation with one click
5. Customer sees seamless transition to human

---

## Testing Checklist

- [ ] Send test order via WhatsApp, verify it appears in distribution_orders
- [ ] Verify team member receives WhatsApp notification
- [ ] Check notification badge shows correct unread count
- [ ] Open conversation and verify badge decreases
- [ ] Test reaction message doesn't break webhook
- [ ] Request specific delivery time, verify it's stored
- [ ] Test escalation flow with frustrated message
- [ ] Verify date grouping in conversation list
- [ ] Check timestamps display correctly
- [ ] Test mobile view of inbox

---

## Priority Order

1. **Fix webhook constraint** - Critical, breaking functionality
2. **Fix order creation** - Critical, orders not being saved
3. **Add team notification** - High, missing business requirement
4. **Fix notification badge** - High, causing confusion
5. **Add delivery time handling** - Medium, improves operations
6. **UI/UX overhaul** - Medium, improves usability
