# Phase 3: Server cart, checkout and orders

Status: done. Date: 2026-10-27. Branch: `agent/functional-m1`.

## Goal

Replace the browser-only single-product order flow with a real server cart, atomic multi-item checkout, stock handling, customer order history/detail/cancel, and staff status changes with enforced transitions.

## What changed

- Models (`apps/server/orders/models.py`): `Cart`, `CartItem` (unique cart/product/size), `OrderItem` (name/price snapshots), nullable legacy `Order.product`, `city`, `payment_method`. Migration `orders/0003_phase3_cart_checkout.py`.
- Services (`apps/server/orders/services.py`, now called through the view layer): cart add/update/remove/merge with size and stock validation; `checkout()` in one `transaction.atomic()` with `select_for_update`, price snapshots, stock decrement (total and per-size), cart clear and `WR-XXXXXXXX` code; `cancel_order()` restoring stock; `change_order_status()` with allowed transitions.
- API: `GET/POST/DELETE /api/cart/`, `PATCH/DELETE /api/cart/items/<id>/`, `POST /api/cart/merge/`, `POST /api/checkout/`, `POST /api/orders/<id>/cancel/`, staff `PATCH /api/orders/<id>/status/`. Legacy `POST /api/orders/` and response keys remain.
- Serializers validate that demo card payments never accept card numbers/CVV/expiry.
- Frontend: server-backed cart with guest localStorage merge on login; `/cart`; `/checkout` with address, city, COD/demo-card and explicit “no card details” copy; `/orders/[id]`; cancel button; My Orders links to details; navbar checkout goes to the real page.
- Tests: `orders/tests/test_phase3_api.py` (8 tests: cart CRUD/merge, size/stock, checkout snapshots/stock/clear, rollback, card rejection, owner/staff scoping, transitions, cancel).

## Decisions and why

- **Server is the source of truth after login.** Guest carts are useful before sign-in, so localStorage remains for guests and is merged once. After that, quantities and stock cannot diverge between tabs/devices.
- **One transaction for checkout.** A separate “reserve stock then create order” flow can leave orphaned reservations. Locking cart items and products, then snapshotting and decrementing in one transaction keeps failure atomic.
- **Order items are snapshots.** Names and prices are copied so a later catalogue edit does not rewrite history.
- **Cancellation is narrow.** Only Pending/Confirmed can be cancelled; shipped/delivered cannot. Cancelling restores the stock that was taken.
- **Demo card is not a payment integration.** The field is named `card_demo`; the UI says no real card details, and the API rejects card data. This is safer than a fake “payment succeeded” flow.
- **Legacy order endpoints stay.** Existing admin and tests still rely on them; new checkout writes multi-item orders with nullable product and nested items.

## Gates (real output)

Cumulative at M1 freeze:

```
backend pytest     450 passed
web vitest          99 passed
tsc --noEmit        clean
eslint              clean (2 warnings)
next build          passed
manage.py check     no issues
makemigrations --check  no changes
```

Phase-specific tests: 8 passed in `orders/tests/test_phase3_api.py`.

## Real-model checks

None; this phase is business logic and HTTP. No model weights are involved.

## Known limitations

- Concurrency is covered by transactional tests, not by a sustained load/race test with real parallel clients.
- No payment gateway, refunds, shipping integration or tax calculation.
- Customers can cancel but cannot edit an existing order.
- The admin status dropdown still lists statuses the backend may reject; the API error is shown, but the UI could filter the choices to legal transitions.

## How to run it

```bash
make demo-data && npm run dev
```

Guest: add to cart → register/login → cart merges → checkout. Staff: `/admin` → Orders → set status.

## Open items for later phases

- Surface only legal next statuses in the admin UI.
- Add order editing (before confirmation) if the product requires it.
- Load/race testing if this leaves a local-only demo.
