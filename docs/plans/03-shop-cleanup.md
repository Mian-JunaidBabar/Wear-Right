# Plan 03: shop cleanup after the review

Small, independent items. One commit each.

## 1. Remove the dead legacy order paths (web)

The real flow is cart → `/checkout` → `POST /api/checkout/`. Two old paths remain:

- `src/components/Navbar.tsx`: `checkoutOpen`, `checkoutForm`, `submitCartCheckout` and the checkout modal JSX. `openCheckout` already navigates to `/checkout`, so the modal can never open. Delete the state, the handler and the modal; remove now-unused imports (`ordersApi`, `orderErrorMessage`, `lastOrderStore` if unused).
- `src/components/ShopView.tsx`: `isOrderModalOpen`, `orderForm`, `submitOrder` and the order modal JSX. "Buy Now" and "Continue to Order" now add to the cart and go to `/checkout` (`orderThroughCheckout`). Delete the dead modal and state.
- `src/features/orders/api.ts`: delete `ordersApi.create` and the `NewOrder` type once nothing imports them.

Acceptance: `rg "ordersApi.create|submitCartCheckout|isOrderModalOpen"` returns nothing; `npx playwright test e2e/07-demo-flow.spec.ts e2e/12-functional-m1.spec.ts` green.

## 2. Close the legacy single-product order endpoint (server)

`POST /api/orders/` (`orders/views.py::OrderListCreateAPIView.post`, `orders/services.py::create_order`) still lets a customer create an order that skips size stock and has no `OrderItem` rows. Nothing in the web app calls it after item 1.

- Make `POST /api/orders/` staff-only (`get_permissions`: `IsAuthenticated` for GET, `IsStaff` for POST). Do not delete `create_order`; the staff smoke tests use it.
- Update `core/tests/test_permission_matrix.py`: the `POST orders/` row for a customer becomes 403. Say in the report why this test changed.

## 3. Product detail overflow at 1280px

`docs/STATUS.md` lists an 8px horizontal overflow on the product page at 1280px. Find the element (Playwright: `document.documentElement.scrollWidth > innerWidth`), fix it, and add 1280px to the overflow check in `e2e/13-m1-quality.spec.ts`.

## 4. Admin product table, first column

On narrow laptop screens the product table scrolls sideways and the Product column (name + photo) scrolls off first, so rows show only "Men Shoes, Formal, All, ...". Make the first column sticky (`sticky left-0 bg-white z-10` on the `th`/`td`) in `AdminView.tsx`.

## 5. Docs

- `docs/STATUS.md`: open issues and decisions updated for plans 00 to 03; the phase table gets Phase 6 "done (basic SVG mannequin)" after plan 02.
- `docs/phases/phase-6.md` from `docs/phases/TEMPLATE.md` for plan 02 (goal, decisions: why SVG and not photos, real gate output, limitations), plus its line in `docs/phases/README.md`.
- `CLAUDE.md` phase map row 6 updated.

## Gates

`make test`, web build, full `make e2e`.
