# Discounts: what is live and how to change it

Last updated 2026-11-27.

## What is live

All of these are standard Shopify discounts in **Shopify admin > Discounts**. No app or theme code applies them; the theme only shows them.

| Discount | Type | Rule | Works with |
| --- | --- | --- | --- |
| Free shipping on orders above ₹1,999 | Automatic, free shipping | Subtotal ₹1,999 or more, India only | All discounts below |
| FIRST150 - ₹150 off your first order | Code `FIRST150` | ₹150 off the order. Subtotal ₹999 or more. Only customers with no past orders (segment "Customers who haven't purchased"), once per customer | Free shipping only |
| 10% off orders of ₹2,999 or more | Automatic, order discount | 10% off the order from ₹2,999 | Free shipping only |
| 12% off orders of ₹3,999 or more | Automatic, order discount | 12% off the order from ₹3,999 | Free shipping only |

- FIRST150, 10% and 12% never stack: a customer gets one of them.
- The ₹150 for FIRST150 is already built into product prices, so the code can be shared openly.
- Shopify recognises returning customers by the email or phone used at checkout, so FIRST150 works once per customer without a sign-up.

## Where the amounts are shown on the site

The theme cannot read discount settings, so these keep their own copy of the amounts:

1. **Announcement bar** (running messages at the top): Online Store > Themes > Customize, click the announcement bar. Each message is a block.
2. **Bag rewards bar** ("Add ₹X more to get 10% off"): Online Store > Themes > Customize, open the bag page, click **JVLI Cart**, section **Rewards bar**. Fields: free shipping from, first discount from and label, second discount from and label. Code: `snippets/jvli-cart-rewards.liquid`.

## Checklist when changing an amount

1. Shopify admin > **Discounts**: change the discount.
2. Theme editor > bag page > **JVLI Cart** > **Rewards bar**: change the same amount.
3. If it is free shipping or FIRST150: edit the matching **announcement bar** message.
4. Open the bag with a cart just below and just above the new amount and check the message.

If step 2 is missed, checkout still applies the right discount; only the bag message is out of date.

## Later: link the bar to the discounts

When someone else manages discounts, the bag bar can read the real amounts instead of keeping a copy. The jvli-favorites app (Cloudflare Worker, reached at `/apps/jvli-favorites`) would look up the automatic discounts through the Admin API and return their minimums; the bar would load them and fall back to the theme settings if the app does not answer. Needs a `read_discounts` permission on the app (re-approved once in Shopify admin) and app code to maintain. Not built.

## Before launch

Remove the test data while the store password is still on:

- the 20 products tagged `test-data`
- "TEST Made to order kurti - delete me" and "Dupatta for TEST Made to order kurti - delete me"
- the 10 test reviews in the home page **JVLI Postcards** section (the section hides itself until real reviews are added)

Then turn off the store password (Online Store > Preferences).
