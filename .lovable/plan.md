

# Dre's Smart Proactive Sales System - With Delivery Timing Intelligence

## Overview

Building on the approved plan, we'll add **business timing intelligence** so Dre knows exactly when to reach out based on your delivery cutoffs and customer proximity to Mahaai.

## Your Business Rules (Now Understood)

| Order Received | Delivery |
|----------------|----------|
| Before 7:00 AM | ✅ Same-day |
| 7:30 - 8:00 AM | ⚠️ Same-day (tight) |
| After 8:00 AM | 📅 Next-day |
| **Mahaai zone** customers | ✅ Same-day even after 9:00 AM |
| Most customers | 🌙 Order at night for next day |

---

## How Dre Will Use This Intelligence

### 1. Smart Outreach Timing

**For Same-Day Delivery Customers:**
- Dre checks at **6:30 AM** for customers who:
  - Usually order for same-day delivery
  - Haven't placed their order yet
  - Are expected to order today
- Message: *"Hey! Dre here 👋 Just a heads up - orders before 7am get same-day delivery! Ready to order?"*

**For Next-Day Customers (most common):**
- Dre checks at **8:00 PM the night before** for customers who:
  - Usually order at night for next-day
  - Haven't placed their order yet
  - Are expected to order for tomorrow
- Message: *"Hey! Dre here 👋 Planning tomorrow's delivery - let me know what you need!"*

**For Mahaai Zone Customers (special treatment):**
- Dre can reach out as late as **9:00 AM** knowing same-day is still possible
- Message: *"Hey! Dre here 👋 Since you're close by, I can still get you same-day delivery! What do you need?"*

### 2. Customer Proximity Detection

We'll calculate and store the distance from each customer to your Mahaai distribution center:
- Mahaai coordinates: `12.126232, -68.897127`
- Customers within ~2km radius = "close proximity" (eligible for extended same-day cutoff)

### 3. Typical Order Time Learning

Dre will learn each customer's ordering habits:
- What **time of day** they usually order (morning vs evening)
- Whether they typically order for **same-day or next-day**
- Pattern: *"Customer A usually orders at 6:15 AM for same-day"*
- Pattern: *"Customer B usually orders at 9 PM for next-day"*

---

## Technical Implementation

### Database Changes

**1. Add to `distribution_customers`:**
```sql
distance_to_dc_meters NUMERIC  -- Distance to distribution center
is_close_proximity BOOLEAN     -- Within extended same-day cutoff zone
```

**2. Add to `distribution_customer_schedules`:**
```sql
typical_delivery_type TEXT     -- 'same_day' or 'next_day'
typical_order_hour INTEGER     -- 0-23, when they usually order
order_time_consistency NUMERIC -- How consistent their order time is
```

**3. New table `dre_outreach_log`:**
```sql
id UUID PRIMARY KEY
customer_id UUID REFERENCES distribution_customers
anomaly_id UUID REFERENCES distribution_order_anomalies
outreach_type TEXT           -- 'missing_order', 'missing_item', 'inactive_customer'
outreach_timing TEXT         -- 'same_day_reminder', 'next_day_planning', 'extended_mahaai'
message_sent TEXT
sent_at TIMESTAMPTZ
customer_responded BOOLEAN
response_at TIMESTAMPTZ
order_generated_id UUID REFERENCES distribution_orders
order_revenue NUMERIC
status TEXT                  -- 'sent', 'responded', 'converted', 'no_response'
```

**4. Add to `distribution_orders` for attribution:**
```sql
dre_outreach_id UUID REFERENCES dre_outreach_log
```

### New Edge Function: `dre-proactive-outreach`

Core logic:
```text
1. Get current time in Curaçao timezone (AST, UTC-4)

2. Check which outreach window we're in:
   - 6:00-6:30 AM → Same-day early bird reminders
   - 8:00-9:00 PM → Next-day planning reminders
   - 8:30-9:30 AM → Mahaai extended same-day (close customers only)

3. For each window, find eligible customers:
   - Expected to order today/tomorrow (from schedules)
   - Haven't ordered yet
   - Match the delivery type for this window

4. Send personalized WhatsApp via Dre's personality

5. Log everything to dre_outreach_log
```

### Dre's Timing-Aware Message Templates

**Same-Day Early Bird (6:30 AM):**
```
pap: "Bon mainta {customer}! Dre aki 👋 Order promé ku 7am pa entrega awe! Bo ta kla pa ordena? 🐟🥬"
en: "Good morning {customer}! Dre here 👋 Orders before 7am get same-day delivery! Ready to order? 🐟🥬"
```

**Next-Day Planning (8 PM):**
```
pap: "Bon nochi {customer}! Dre aki 👋 Ta prepará entrega di mañan - ki kos bo mester? 🐟🥬"
en: "Good evening {customer}! Dre here 👋 Planning tomorrow's deliveries - what do you need? 🐟🥬"
```

**Mahaai Extended (9 AM):**
```
pap: "Bon dia {customer}! Dre aki 👋 Paso bo ta serka, mi por entrega ainda awe! Ki kos bo ke? 🐟🥬"
en: "Good morning {customer}! Dre here 👋 Since you're close by, I can still deliver today! What do you need? 🐟🥬"
```

---

## Updated Cron Schedule

| Time (AST) | Job | Purpose |
|------------|-----|---------|
| 5:00 AM | `order-pattern-analyzer` | Daily pattern analysis + order time learning |
| 6:30 AM | `dre-proactive-outreach` | Same-day early bird reminders |
| 9:00 AM | `dre-proactive-outreach` | Mahaai zone extended same-day |
| 8:00 PM | `dre-proactive-outreach` | Next-day planning reminders |

---

## Files to Create/Modify

### New Files:
1. **`supabase/functions/dre-proactive-outreach/index.ts`**
   - Smart timing-based outreach engine
   - WhatsApp integration with Dre's personality
   - Proximity-aware same-day eligibility

2. **`src/components/fnb/DreSalesPerformance.tsx`**
   - Dashboard showing Dre's conversion stats
   - Metrics by outreach type (same-day vs next-day)
   - Revenue attributed to Dre

### Modified Files:
1. **`supabase/functions/whatsapp-ai-agent/index.ts`**
   - Detect responses to Dre's proactive outreach
   - Link orders to outreach log for attribution
   - Track conversion success

2. **`supabase/functions/order-pattern-analyzer/index.ts`**
   - Calculate `typical_order_hour` from order timestamps
   - Determine `typical_delivery_type` (same-day vs next-day)
   - Calculate `distance_to_dc_meters` for new customers

3. **`supabase/config.toml`**
   - Add `dre-proactive-outreach` function

4. **`src/pages/fnb/FnbDashboard.tsx`** or **`FnbAnalytics.tsx`**
   - Add Dre Sales Performance card/section

---

## Expected Results

After implementation:
- **Dre reaches out at the right time** - not too early, not too late
- **Same-day customers get 6:30 AM nudges** to make the 7 AM cutoff
- **Night owls get 8 PM reminders** when they're planning tomorrow
- **Mahaai customers get special treatment** with extended same-day cutoffs
- **Every conversion is tracked** - you'll know exactly how much revenue Dre generates
- **Dashboard shows ROI** - messages sent, response rate, orders generated, revenue

This makes Dre not just responsive, but strategically proactive - reaching out at the exact moment when customers are most likely to convert! 🐟

