

# Fix: Order Not Created from Forwarded Emails

## Problem Analysis

Your email processing **successfully extracted** all the data:
- **Customer**: Dreams Curacao Resorts, Casino & Spa  
- **PO Number**: DCU0000003268
- **Delivery Date**: 2026-01-30
- **Item**: CHEESE PAISA 1X425GR → Paisa (30 kg, high confidence)

**BUT no order was created** because `matched_customer_id` is NULL.

### Why `matched_customer_id` is NULL

The email-webhook matches customers by checking if the **sender's email** exists in:
- `whatsapp_phone` column
- `notes` column

**The problem**: You forwarded the email, so the sender is `efg.deandrade@gmail.com` (your email), NOT the original customer email (`Eliandra.carolie@dreamsresorts.com`).

The Dreams Hotel customer record has different emails stored, so no match occurs.

### Order Creation Condition

Line 568 of process-email-order:
```typescript
if (orderItems.length >= AUTO_CREATE_MIN_ITEMS && email.matched_customer_id) {
```

Since `matched_customer_id` is NULL → order creation is skipped entirely.

---

## Solution

Add **AI-based customer matching** in `process-email-order` when initial email-based matching fails. The AI already extracts `customer_name` ("Dreams Curacao Resorts, Casino & Spa"), so we can use fuzzy matching against the customer database.

### Technical Changes

| File | Changes |
|------|---------|
| `supabase/functions/process-email-order/index.ts` | Add customer lookup by AI-extracted name when `matched_customer_id` is NULL |

### Code Flow

1. If `email.matched_customer_id` is NULL after email-webhook processing
2. Use the AI-extracted `customer_name` to search `distribution_customers`
3. Apply fuzzy matching (ILIKE with partial names)
4. If a match is found, update `matched_customer_id` on the email record
5. Proceed with order creation using the matched customer

### Implementation Details

```typescript
// After AI extraction, if no customer was matched by email
if (!email.matched_customer_id && extractedData.customer_name) {
  console.log(`No email-matched customer, searching by AI-extracted name: "${extractedData.customer_name}"`);
  
  // Search for customer by extracted name
  const searchName = extractedData.customer_name.toLowerCase();
  const searchWords = searchName.split(/\s+/).filter(w => w.length > 3);
  
  // Try progressively looser matches
  let matchedCustomer = null;
  
  // 1. Exact match first
  const { data: exactMatch } = await supabase
    .from("distribution_customers")
    .select("id, name")
    .ilike("name", extractedData.customer_name)
    .limit(1)
    .maybeSingle();
    
  if (exactMatch) {
    matchedCustomer = exactMatch;
  } else {
    // 2. Try partial matches with key words (e.g., "Dreams")
    for (const word of searchWords) {
      const { data: partialMatch } = await supabase
        .from("distribution_customers")
        .select("id, name")
        .ilike("name", `%${word}%`)
        .limit(1)
        .maybeSingle();
        
      if (partialMatch) {
        matchedCustomer = partialMatch;
        break;
      }
    }
  }
  
  if (matchedCustomer) {
    console.log(`AI name matched to customer: ${matchedCustomer.name} (${matchedCustomer.id})`);
    
    // Update email record with matched customer
    await supabase
      .from("email_inbox")
      .update({ matched_customer_id: matchedCustomer.id })
      .eq("id", emailId);
      
    // Use for order creation
    email.matched_customer_id = matchedCustomer.id;
  } else {
    console.log(`Could not match customer by AI name: "${extractedData.customer_name}"`);
  }
}
```

---

## Why This Solves the Problem Permanently

1. **Forwarded emails**: Even when YOU forward an email, the AI extracts the original customer name from the PO content
2. **AI name → Customer match**: "Dreams Curacao Resorts" will fuzzy-match to "Dreams Hotel" 
3. **Order creation**: With `matched_customer_id` populated, the order creation logic proceeds normally

---

## Expected Result After Fix

For your forwarded email (DCU0000003268):
1. Email-webhook: `matched_customer_id` = NULL (sender is your email)
2. process-email-order: AI extracts "Dreams Curacao Resorts, Casino & Spa"
3. **NEW**: Fuzzy search finds "Dreams Hotel" customer
4. **NEW**: Updates email with matched customer
5. Creates order with 1 item (Paisa 30kg)
6. Order appears in your Orders list

---

## Files to Modify

| File | Action |
|------|--------|
| `supabase/functions/process-email-order/index.ts` | Add AI-based customer matching after extraction, before order creation |

