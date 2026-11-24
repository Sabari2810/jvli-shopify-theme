# Referrals and discounts plan

Status: **proposal, nothing built.** Confirm each part before it is implemented.

Flowcharts (private, share from the page's Share menu):

- Referral plan: https://claude.ai/artifact/NptNMsnFJVughMSH5P9Kij
- How favorites work today: https://claude.ai/artifact/NoarsmEEvFKoGpg8XgcAD6

## What was asked

- Every customer gets a referral link.
- A purchase through the link earns the referrer credit. 10 referrals earns a free kurti.
- First-time customers get a FIRST150 code at checkout.
- Referrer and referred friend both get ₹150.
- Free shipping above a threshold (₹2,000 floated; not decided).
- No COD.

## Recommendations

1. **Launch with Phase 1 only.** FIRST150 and free shipping are built into Shopify and need no code. A referral programme needs customers to share it, and the store has no real orders yet. Revisit referrals after the first 30 to 50 customers.
2. **One first-order discount.** The friend's ₹150 from a referral link is the same FIRST150 discount, never both. Stacking would give ₹300 (30%) off a ₹999 kurti.
3. **One referrer reward.** ₹150 store credit per referral. "10 friends = a kurti" is the same credit added up (10 × ₹150 = ₹1,500) and only a marketing line, with no second system.
4. **Pay the referrer after delivery and the return window.** Cancel the pending reward on return or cancellation.
5. **Block self-referrals.** Ignore orders where the friend has the referrer's email, phone or address.
6. **Credit expires after 6 months.**
7. **Don't publish FIRST150 openly.** Give it in exchange for an email or WhatsApp sign-up, and limit it to customers with no past orders. Test how that limit behaves with guest checkout before relying on it.
8. **Minimum order for FIRST150**, for example ₹999.
9. **Free-shipping threshold** about 20 to 30% above the average order. Starting point: ₹1,999 ("two kurtis or any saree"), then adjust with real data. Shipping is ₹100 today.
10. **Referrals: an existing app vs building it.** An app costs a subscription but no maintenance. Building it into jvli-favorites is free to host but is our code to maintain. Decide when Phase 2 starts.

## Phase 1: launch offers (no new code)

- FIRST150: Shopify discount, ₹150 off, first order only, minimum order to decide.
- Free shipping: Shopify shipping discount over the threshold, combinable with FIRST150.
- Theme work (needs confirmation): "₹X away from free shipping" line in the bag, and a sign-up box that gives the code.

## Phase 2: referrals

1. A signed-in customer copies their link from the account page, e.g. `thejvlistore.in/?ref=CODE`.
2. The friend's browser remembers the referral for 30 days and FIRST150 is applied to their bag.
3. The friend pays online; the referral code travels with the order.
4. Not a first order: normal price, no reward.
5. First order: the friend gets ₹150 off. The app hears about the paid order, checks for self-referral, and marks a pending reward on the referrer's customer record.
6. After delivery and the return window, the app adds ₹150 store credit to the referrer. Returned or cancelled: the pending reward is cancelled.
7. The referrer spends the credit at checkout with no code.

If built in jvli-favorites, it would follow the favorites pattern (app proxy at `/apps/...`, signed customer ID, data on the customer record) and needs:

- new permissions: read orders, and store credit (`write_store_credit_account_transactions`); the app is re-approved once in Shopify admin
- an order webhook (the app hears about no orders today)
- an account page section in the theme

## Facts checked (2026-11-24)

- jvli-favorites runs on Cloudflare Workers (free plan) at `jvli-favorites.thejvlistore.workers.dev`, reached through the app proxy `/apps/jvli-favorites`. Its D1 database holds only Shopify sessions. Current scopes: `read_customers, read_products, write_app_proxy, write_customers`.
- The store uses new customer accounts (needed for store credit) and has gift cards enabled.
- Store credit could not be confirmed from the Shopify connector (no permission to read it). Check: open any customer in Shopify admin and look for a **Store credit** card.

## Still to decide

- Margin on a ₹999 kurti (is ₹150, 15%, affordable?)
- FIRST150 minimum order
- Free-shipping threshold
- Return window length before the referrer is paid
- Whether store credit is on for the store
- Referral app vs building it ourselves
