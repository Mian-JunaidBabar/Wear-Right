# Demo guide (Phase 1)

## Before the demo (5 minutes)

```bash
make install        # only if dependencies changed since you last ran it
make demo-reset     # fresh database: 11 products, the admin and the demo customer
make demo           # production build + both servers; open http://localhost:3000
```

Use Chrome. The camera works on `localhost` without HTTPS; allow the camera prompt once. Good light on the face matters for the scanner. `Ctrl+C` stops everything. If something looks stale, run `make demo-reset` again.

| Who | Email | Password |
| --- | --- | --- |
| Customer (seeded) | `demo@wearright.local` | `demo12345` |
| Admin (seeded) | `admin@wearright.local` (or `admin`) | `admin12345` |

You can also create a new account at `/register`.

## Suggested walkthrough (about 8 minutes)

1. **Home and shop (guest).** Browse `Shop`, pick a category, open a product page (size, stock, "Complete This Outfit", related products). Add an item to the cart.
2. **Guest checkout is protected.** Click Checkout: you are sent to login and the cart is kept.
3. **Real accounts.** Register (try a weak password and a duplicate email to show validation), or log in as the demo customer. Reload the page: still signed in. Sign-in lives in httpOnly cookies, not in the page.
4. **Face scan.** `Face Scan` then `Start Camera` (auto multi-frame scan) or `Upload Face Image`. The result shows skin tone, confidence and lighting; signed-in users get the tone saved to their profile.
5. **Recommendations and complete the outfit.** `View Recommended Products`, change the style, click `Complete Outfit` on a product, add the full look to the cart.
6. **Checkout.** Cart, Checkout, fill the form, Place Order. The confirmation page opens; `My Orders` lists the order and can download an invoice PDF.
7. **Profile.** Edit name, gender, preferred style and sizes; they persist.
8. **Admin (second window or log out first).** Log in as admin: dashboard, Orders (the order just placed), change its status, Products (add a product with an image), Face Scans. Log in as a normal customer and open `/admin`: access is refused, and the API answers 403.

## If something goes wrong

- **Camera blocked or no webcam:** use `Upload Face Image`.
- **"Rescan Required" result:** lighting was too dark or bright, or no skin was detected. Face a window, keep the face centred, scan again.
- **Page shows an error after a long idle:** refresh. Sessions last 30 minutes and renew themselves for up to 7 days.
- **Port already in use:** stop the old run (`Ctrl+C`), or free ports 3000 and 8000.
- **Database refused connection:** `make db-up` (Docker must be running).

## Honest limits to mention if asked

- Skin tone detection is the existing classical (LAB/ITA) method; the improved version is Phase 3.
- Recommendations use the current colour rules and seed catalogue; the real catalogue import is Phase 2, the ranker is Phase 4, the layered mannequin is Phase 5.
- The cart is stored in the browser for now (server cart is Phase 6). Payments are cash on delivery only.
- Password reset by email is not implemented. Customers cannot cancel or edit an order after placing it.
