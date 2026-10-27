# Demo guide — functional M1

## Before the demo (5 minutes)

```bash
make demo-data      # Postgres, migrations, catalogue, tone rules, demo customer + staff
make demo           # production build + both servers; open http://localhost:3000
```

Use Chrome. The camera works on `localhost` without HTTPS; allow the camera prompt once. Good light matters for the scanner — the manual tone picker is the reliable fallback. `Ctrl+C` stops the servers. If data looks stale, run `make demo-reset && make demo-data` for a fresh database.

| Who | Email | Password | Where |
| --- | --- | --- | --- |
| Customer (seeded) | `demo@wearright.local` | `demo12345` | `/login` |
| Staff (seeded) | `admin@wearright.com` | `admin123` | `/admin/login` |
| Staff (legacy alias) | `admin@wearright.local` (or `admin`) | `admin12345` | `/admin/login` |

New accounts can be created at `/register`. Staff accounts are refused on the shop's `/login` ("team account" message); admin sessions are separate from shop sessions, so signing in on both is not a problem.

## Suggested walkthrough (about 8–10 minutes)

1. **Browse as a guest.** Home → Shop. Change category/gender/search/sort and page through results. Open a product: size picker, stock, related items, “Complete This Outfit”. Add an item to the cart.
2. **Cart and auth.** Open the cart drawer → Checkout. A guest is sent to login and the guest cart is kept. Register a new account (show a weak password/duplicate email error if useful). After login the guest cart is merged into the server cart.
3. **Skin tone.** `/scan` → Start Camera (multi-frame) or upload a photo. If no face is detected, show the rescan card and click **Skip, pick my tone**, choose depth/undertone, and continue. Signed-in scans are saved to the profile.
4. **Recommendations.** “View Recommended Products” shows ranked picks with reason chips and best/avoid colour palettes. Change style and observe the ranking.
5. **Complete the look.** From a product, open the complete-look strip. Show one pick per slot, swap an alternative, then **Add whole look to cart**.
6. **Checkout.** `/cart` → edit quantities → Checkout. Enter name/phone/address/city. Choose **Cash on delivery**; show that **Card (demo)** only accepts demo data and never asks for card numbers. Place the order. The confirmation page appears and the cart empties.
7. **Order history.** `/my-orders` → **View order** → status and items. While Pending/Confirmed, cancel it and show that stock is restored. (Place another order if you need one for the admin step.)
8. **Staff.** In a second window go to `/admin/login` and sign in as admin. Show dashboard stats, product create/edit (live image preview, **Suggest colour**, visible/hidden eye, delete confirmation), and Orders. Change the order to Confirmed/Shipped; the customer’s order detail then shows the new status. Show Team & Roles: add a member with the Order Handler role and sign in as them in a private window — they see Orders/Bookings only and no Team section. Open `/admin/login` with a customer account: it is refused ("no admin access"); shop `/login` refuses team accounts.

## If something goes wrong

- **Camera blocked / no webcam:** use upload, or “Skip, pick my tone”.
- **“Rescan Needed”:** lighting is poor or no face was detected. Improve light/framing, or use the manual picker.
- **Session expired after a long idle:** refresh; access tokens are short-lived and refresh automatically.
- **Port in use:** stop the previous run, or free 3000/8000.
- **Database refused:** `make db-up` (Docker must be running).

## Honest limits to mention if asked

- Skin-tone detection is the existing classical LAB/ITA method; its accuracy is **unmeasured** (no labelled photo set). The algorithm is frozen until Phase 7.
- Recommendations and complete-look rules come from colour theory and hand-written defaults, not user studies or sales data. Phase 8 is the user study.
- The mannequin places garment layers, but its bodies are procedural grey shapes and pieces are box-positioned, not draped. Realism is Phase 6 work.
- Card payment is a **demo** only. There is no payment processor.
- Demo prices are placeholders, not market prices.
- Password reset, email verification and login rate limiting are not implemented.
