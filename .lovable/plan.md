
# Fix Weekly PO Template Parsing - Left-to-Right Scan

## Problem Analysis

The current AI prompt incorrectly aggregates data from all weekday columns. Your requirement is to:

1. Scan **left to right** (Monday → Friday)
2. Identify the **latest (rightmost) day column** that contains data
3. Extract items **only** from that single day column

---

## Technical Changes

### File: `supabase/functions/parse-purchase-order/index.ts`

**Update the system prompt** to implement left-to-right scanning logic:

```text
SPECIAL HANDLING FOR WEEKLY ORDER TEMPLATES (Fuik/Osteria Rosso style):
When the content includes columns for weekdays (Monday through Friday):

1. This file has columns: Item Name | Unit | Price R | Price F | Status | Monday | Tuesday | Wednesday | Thursday | Friday

2. CRITICAL: Scan LEFT TO RIGHT to find the LATEST filled day column:
   - Start at Monday, check if ANY cell has a quantity
   - Move to Tuesday, check if ANY cell has a quantity
   - Continue through Wednesday, Thursday, Friday
   - The LAST (rightmost) column that contains data is the target day
   - Example: If Monday, Tuesday, and Thursday have data → use Thursday

3. Extract items ONLY from that single identified day column
   - Do NOT combine quantities from multiple days
   - Do NOT extract items from earlier days

4. EXCLUDE items where Status column contains "HOLD"

5. Parse quantity strings carefully:
   - "3 tros" → quantity: 3, unit: "bunch"
   - "2 kg" or "2 kilo" → quantity: 2, unit: "kg"
   - "250 gram" → quantity: 0.25, unit: "kg" (convert grams to kg)
   - "1 stuk" or "4 st" → quantity: 1 or 4, unit: "stuks"
   - "3 bos" → quantity: 3, unit: "bunch"
   - "1 hele" → quantity: 1, unit: "whole"

6. Set detected_delivery_weekday to the day column that was used

7. Set po_number to "Weekly-YYYY-MM-DD" using current date
```

---

## Expected Behavior

**For the uploaded file (2025_Orderlist_FUIK-2.xlsx):**

1. AI scans left-to-right: Monday → Tuesday → Wednesday → Thursday → Friday
2. Identifies Thursday as the latest column with data
3. Extracts ONLY Thursday items:
   - Carrots: 3 kg
   - Romaine lettuce: 0.1 kg (converted from 100 gram)
   - Sali (Sage): 0.1 kg (converted from 100 gram)
   - Pumpkin: 1 whole
   - Red onion: 3 kg
   - Tomatie Perita: 2 kg
   - Limes: 2 kg

4. Monday/Tuesday/Wednesday items are ignored
5. `detected_delivery_weekday` = "Thursday"

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/parse-purchase-order/index.ts` | Update system prompt to scan left-to-right and parse only the latest filled day column |

---

## Validation

After deployment, re-upload the same file and verify:
- Only Thursday items extracted (~7 items)
- `detected_delivery_weekday` = "Thursday"
- Items from Monday/Tuesday/Wednesday are NOT included
