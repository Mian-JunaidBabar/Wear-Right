# Wear Right — PRD & Build Plan

Oct 7, 2026 · @Deep Dev Solutions

Wear Right is a store that does the styling for people who don't know fashion: scan a face, get 10 to 15 items that suit that skin tone, pick one, and the system completes the look and shows it on a mannequin. Roughly 40% of this already exists in the repo; the plan below finishes it in about 8 build weeks by reusing open source for every hard part and training nothing heavy.

## Where the repo stands

The client and server are already wired together; the database and CORS exist too, they are just configured through env files. The real gaps are auth (fake), the mannequin (a CSS drawing), and outfit logic that ignores color.

| Area                    | Status           | What is actually there                                                                                                                                                 | What to do                                                                                                                          |
| ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Database                | Works, misread   | `settings.py` picks DB by env: `.env` has `USE_SQLITE=True`, so local runs on SQLite. `.env.production` points `DATABASE_URL` at Supabase Postgres.                    | Run Postgres locally via Docker, delete `USE_SQLITE`, collapse the 3 duplicated `DATABASES` blocks into one `dj-database-url` line. |
| CORS                    | Works, soon moot | `django-cors-headers` installed, origins read from `CORS_ALLOWED_ORIGINS`. Vite dev runs on port 3000, which is allowed.                                               | After the Next.js switch, rewrites send `/api` to Django on the same origin, so CORS config can go.                                 |
| Client to API           | Works            | 7 components call Django through `src/config/api.ts` (`VITE_API_URL`). Products, orders, bookings, face scan, outfit, admin dashboard all hit real endpoints.          | Ported to Next.js in phase 1; all calls go through one `lib/api.ts`.                                                                |
| Skin tone (FR-04/05/06) | Mostly done      | `api/utils.py`: Haar face detect, gray-world white balance, gamma, CLAHE, HSV+YCrCb skin mask, ITA angle on CIELAB to Fair/Medium/Dark. Multi-frame, picks best frame. | Keep the pipeline, fix two color bugs, swap Haar for MediaPipe, add undertone and Monk scale.                                       |
| Auth (FR-01/02)         | Fake             | `AuthView.tsx` sets `isLoggedIn: true` in React state for any email and password. No register or login endpoint exists.                                                | Build real auth with httpOnly JWT cookies.                                                                                          |
| Permissions             | Broken           | DRF default is `AllowAny`. Anyone can create, edit or delete products and orders.                                                                                      | `IsAdminUser` on admin and write endpoints.                                                                                         |
| Preferences (FR-03)     | Partial          | `UserProfile` model + endpoint exist, but not tied to a logged-in user.                                                                                                | Bind to `request.user`.                                                                                                             |
| Product filter (FR-08)  | Weak             | Backend filters on a manually typed `compatible_skin_tone` field. The real color rules live in the client (`recommendationRules.ts`), so logic is split.               | Move rules to the backend as one source of truth, rank by color.                                                                    |
| Outfit (FR-09)          | Weak             | `OutfitGenerationAPIView` takes `.first()` shirt, pant, shoe, accessory with the same tone + style tag. No color harmony, no look templates.                           | Rebuild as slot templates + color scoring.                                                                                          |
| Mannequin (FR-10/11/12) | Fake             | `ShopView.tsx` draws a grey pill with a shirt icon and says "advanced AI model can be added later". No sizes, no angles.                                               | Build the 2D layered mannequin.                                                                                                     |
| Orders                  | Partial          | One product per order, COD + WhatsApp link. No cart.                                                                                                                   | Add Cart and OrderItem so a full look can be bought in one go.                                                                      |
| Admin (FR-13/14)        | Mostly done      | 85 KB `AdminView.tsx` with CRUD, dashboard, bookings. Categories and colors are hard-coded `choices` in models.                                                        | Make categories, colors and tone rules DB tables.                                                                                   |
| Hosting                 | Out of scope     | Django is set up for Vercel serverless (`vercel.json`, `build.sh`, Vercel origins in settings).                                                                        | No deployment planned. Delete the Vercel files; everything runs on one laptop.                                                      |
| Hygiene                 | Messy            | Client still carries AI Studio leftovers (`express`, `@google/genai`); hard-coded fallback `SECRET_KEY`; 60 to 85 KB single-file views.                                | Clean deps and secrets in phase 0; split big views only where we touch them.                                                        |

## Scope

We build all 14 functional requirements from the FYP doc, because the panel will check them one by one, but each at the cheapest level that honestly meets its wording. Two things get added: photo upload as an alternative to the live selfie, and a cart so a complete look can be bought together.

| ID     | Requirement                | Priority | How we meet it                                                                                                                                             |
| ------ | -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01  | Registration               | Must     | `POST /api/auth/register/` on Django `User` + `UserProfile`.                                                                                               |
| FR-02  | Login / logout             | Must     | JWT (access + refresh), logout blacklists the refresh token.                                                                                               |
| FR-03  | Preferences                | Must     | Styles (Eastern/Western/Casual/Formal), gender, fit size, favorite and avoided colors on `UserProfile`.                                                    |
| FR-04  | Face capture               | Must     | Live selfie (exists) plus file upload. In-browser MediaPipe checks face is centered and lit before capture.                                                |
| FR-05  | Illumination normalization | Must     | Existing gray-world + gamma + CLAHE, plus a too-dark / too-bright rejection with a retake prompt.                                                          |
| FR-06  | Skin tone classification   | Must     | Depth (Fair/Medium/Dark, Monk 1 to 10) + undertone (warm/cool/neutral) from cheek and forehead pixels.                                                     |
| FR-07  | Category discovery         | Must     | Exists in ShopView; switch to DB-driven categories.                                                                                                        |
| FR-08  | Top 10 to 15 picks         | Must     | Backend ranker: palette match x style preference x stock, returns 15.                                                                                      |
| FR-09  | Complete the look          | Must     | Look templates (casual, formal suit, eastern) fill each slot with the best color-harmonious item. Shirt gets pants + shoes; suit gets shoes + watch + tie. |
| FR-10  | Mannequin preview          | Must     | 2D layered mannequin: background-removed garment PNGs placed on a base body.                                                                               |
| FR-11  | Body size                  | Must     | 3 body presets (slim, regular, plus) mapped to waist ranges, e.g. 30-32, 34-38, 40+.                                                                       |
| FR-12  | Multi-angle                | Should   | Front and back views; side view only where the product has a side image, otherwise fall back to front (the doc's own alternate flow allows this).          |
| FR-13  | Catalog admin              | Must     | Exists. Upload now auto-removes background and suggests color + category.                                                                                  |
| FR-14  | Category and style config  | Must     | Categories, colors and tone-to-color rules become DB tables editable in admin.                                                                             |
| New    | Photo upload               | Should   | Same endpoint as the selfie, accepts a file.                                                                                                               |
| New    | Cart + multi-item order    | Should   | "Add whole look to cart", COD checkout, WhatsApp confirmation stays.                                                                                       |
| New    | Realistic try-on           | Stretch  | CatVTON on a model photo via Hugging Face. Only if weeks 7-8 have slack.                                                                                   |
| NFR-05 | Image privacy              | Must     | Already true in code: images are processed in memory and never saved. Keep it that way, HTTPS only.                                                        |
| NFR-03 | 99.9% uptime               | Cut      | Not provable for an FYP. Reword to "available during evaluation" in the doc.                                                                               |

Out of scope, as the FYP doc already says: AR try-on on live video, payment gateway, fabric simulation.

## Core journey

The whole product is one guided path from face to checkout in under 3 minutes; everything else is a normal store around it.

1. **Sign up** with name, email, password, gender. Pick 1 or more styles and a body preset (slim / regular / plus).
2. **Scan.** Take a selfie or upload a photo. The browser checks face in frame and light before sending 3 frames.
3. **Result card.** "Medium depth, warm undertone (Monk 5)" with the 6 to 8 colors that suit them and 3 to avoid. Saved to the profile so they never scan again.
4. **Your edit.** 10 to 15 ranked items for their tone and chosen style, each with a short why ("olive flatters warm undertones").
5. **Pick one item.** The system completes the look: shirt gets pants + shoes + one accessory; a suit gets shirt, tie, shoes, watch; a kameez gets footwear + waistcoat. Each slot has 2 swap alternatives.
6. **Mannequin.** The full look appears on the mannequin at their body preset. Toggle front / back, switch size.
7. **Add the whole look to cart.** Checkout with COD; WhatsApp confirmation to admin.

Guests can browse and scan; saving results and checkout require an account.

## Module specs

No module needs a trained deep model. Skin tone is classic color science on landmark-picked pixels, recommendations are a scored rules engine, and the mannequin is image compositing. That is honest, defensible in a viva, and buildable in weeks.

### 1. Skin tone engine (FR-04, 05, 06)

Keep `api/utils.py` and upgrade three parts.

- **Where we sample.** Replace Haar cascade + center crop with MediaPipe Face Landmarker (478 points). Sample only left cheek, right cheek and forehead polygons, so eyes, brows, lips, beard and hair never pollute the average. Same model runs in the browser for live guidance ("move closer", "too dark").
- **Depth.** Keep ITA on median CIELAB of the sampled pixels, trimmed to the 10th to 90th L\* percentile. Buckets: ITA above 41 = Fair, 10 to 41 = Medium, below 10 = Dark (current thresholds, tune on our labeled set). Also report nearest Monk Skin Tone swatch (1 to 10) by Delta E 2000 for the result card.
- **Undertone (new).** Hue angle h = atan2(b\*, a\*). Higher h (more yellow) = warm, lower (more red/pink) = cool, middle = neutral. Start thresholds at 58 and 50 degrees, calibrate on the labeled set. Add a 2-question override on the result card: "gold or silver jewelry?", "burn or tan?". Undertone drives color picks more than depth does.
- **Confidence.** Today it is a hard-coded 92 minus penalties. Replace with: frame agreement (do 3 frames give the same bucket) x skin pixel count x lighting grade.
- **Output.** `{depth, monk, undertone, ita, hue, confidence, lighting, palette}` saved on `UserProfile` and as a `FaceScanRecord` tied to the user. Image never stored (NFR-05).
- **Proof for NFR-02.** Collect 80 to 100 consented photos from classmates, two people label each against the printed Monk swatch card, test in 2 lighting setups. Report accuracy and a confusion matrix for the 3 buckets. Google's MST-E set can be used as a reference check but its terms forbid training on it.

### 2. Recommendations and complete-the-look (FR-08, 09, 14)

One backend service, plain Python, about 250 lines, fully unit-tested. The rules currently in `recommendationRules.ts` move into a `ToneColorRule` table (depth, undertone, color, score +2 best / +1 good / -2 avoid) that admin can edit, which is FR-14.

- **Top picks (FR-08).** Filter: gender, active, in stock in the user's size. Score = 0.5 x palette score + 0.3 x style match + 0.2 x preference match (favorite colors, formality). Cap 3 items per category so the list is varied. Return 15, each with a one-line reason.
- **Look templates (FR-09).** Slots per look type:
  - Western casual: top, bottom, footwear, optional accessory
  - Formal / suit: suit or blazer, shirt, trousers, formal shoes, optional tie, watch, belt
  - Eastern men: kameez shalwar, footwear (khussa, peshawari, sandal), optional waistcoat or shawl
  - Eastern women: kurta, bottom, dupatta, footwear, optional jewelry or clutch
- **Filling a slot.** Candidates must match gender and sit within 1 formality level of the anchor item. Score = color harmony with the anchor + palette score for the user + formality match. Harmony rules: neutrals (black, white, grey, navy, beige, khaki, brown, denim) go with anything; otherwise analogous hues (within 30 degrees) or complementary (150 to 210 degrees) score high; two loud saturated colors score low; leather shoes and belt should match. Return best pick + 2 swaps per slot.
- **Product data this needs.** Each product gets `slot`, `gender`, `formality` (1 to 5), multi `style_tags`, `color_name`, `color_hex`. Without clean tags none of this works, which is why auto-tagging (module 5) matters.

### 3. Virtual mannequin (FR-10, 11, 12)

A layered 2D composite, not a 3D sim, which matches the doc's own exclusions.

- **Base bodies.** Generate male and female neutral-grey bodies in 3 sizes with MPFB (MakeHuman's Blender add-on), render front and back with a fixed camera at 800 x 1600 transparent PNG. 2 genders x 3 sizes x 2 angles = 12 images, about one day of work, CC0 assets.
- **Garments.** On admin upload, rembg cuts the background out and stores a transparent PNG. Front image required, back image optional.
- **Placement.** A JSON anchor map per body preset gives a box for each slot (torso, legs, feet, wrist, neck). The garment PNG is scaled into its box. Layer order: bottom, top, outerwear, shoes, accessories. Plain absolutely-positioned images in React are enough; react-konva only if we want drag-to-adjust in admin.
- **Size (FR-11).** Switching preset swaps the body image and the anchor map.
- **Angles (FR-12).** Back view uses back images; a product with no back image falls back to front with a note.
- **Catalog rule.** Product photos must be flat-lay or ghost-mannequin, front-facing, plain background. Mixed lifestyle photos will look broken on the mannequin. Sourcing 80 to 120 consistent product images is the real bottleneck of this whole project.

### 4. Auth, profile, cart (FR-01, 02, 03)

- `dj-rest-auth` on top of `djangorestframework-simplejwt`: login, logout, refresh, user, with tokens in httpOnly cookies that JavaScript never touches. Registration is a 20-line custom view.
- Permissions: read endpoints public; profile, scan history, cart, orders need login; product, category and rule writes need `is_staff`.
- `CartItem(user, product, size, qty)` and `Order` + `OrderItem`, replacing the single-product order. "Add look to cart" posts all slots at once.

### 5. Admin auto-tagging (FR-13, should-have)

- On upload: rembg cutout, then k-means (k=3) on the visible pixels in CIELAB, nearest named color by Delta E 2000. Prefills `color_name` and `color_hex`.
- FashionCLIP zero-shot on labels like "a photo of a men's kurta" prefills category, slot and style. Admin confirms or edits.
- Optional: store the FashionCLIP embedding in Postgres with pgvector for a "similar items" row on product pages.

## Open source picks

Every hard part has a free, maintained library; we write glue, rules and UI, not models. Licenses below are fine for an academic project; the two non-commercial ones are flagged.

| Need                                         | Use                                                                                                                                         | License                                   | Effort                | Why this one                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework                           | Next.js 16 (App Router), replacing Vite                                                                                                     | MIT                                       | Phase 1               | Route per page, rewrites remove CORS, existing React components port as client components.                                                                                                                                    |
| Face landmarks (server + browser)            | [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (`mediapipe`, `@mediapipe/tasks-vision`) | Apache 2.0                                | 1 to 2 days           | 478 points, runs on CPU, same model in Python and JS. Lets us sample cheeks and forehead precisely.                                                                                                                           |
| Color math (CIELAB, Delta E 2000, hue angle) | `coloraide` or `colour-science`                                                                                                             | MIT / BSD-3 (verify)                      | Hours                 | Correct conversions instead of hand-rolled OpenCV scaling.                                                                                                                                                                    |
| Skin tone reference scale                    | [Monk Skin Tone scale](https://skintone.google)                                                                                             | Free from Google, check attribution terms | Hours                 | 10 swatches for the result card; already cited in the FYP doc. MST-E images are evaluation only, no training.                                                                                                                 |
| Background removal for garments              | [rembg](https://pypi.org/project/rembg) with `isnet-general-use` or `u2net_cloth_seg`                                                       | MIT code, per-model weight licenses       | 1 day                 | Clean PNG cutouts for the mannequin. Skip the default `bria-rmbg` model: about 1 GB and its own weight license.                                                                                                               |
| Mannequin base bodies                        | [MPFB](https://extensions.blender.org/add-ons/mpfb/) (MakeHuman for Blender)                                                                | Assets CC0, tool GPL                      | 1 day                 | Parametric male/female bodies in any size, render front + back once. We ship renders, not code.                                                                                                                               |
| Product auto-tagging + similar items         | [FashionCLIP](https://huggingface.co/patrickjohncyh/fashion-clip) via `transformers`                                                        | MIT                                       | 2 days                | Zero-shot category, style and color hints, trained on 800K fashion products.                                                                                                                                                  |
| Vector search for "similar items"            | `pgvector` + `pgvector-python`                                                                                                              | PostgreSQL License                        | 1 day                 | Stays inside Postgres, which the FYP doc promises. The `pgvector/pgvector` Docker image has it built in.                                                                                                                      |
| Real auth                                    | `dj-rest-auth` + `djangorestframework-simplejwt`                                                                                            | MIT                                       | 1 day                 | httpOnly JWT cookies and logout blacklisting with almost no custom code.                                                                                                                                                      |
| Seed catalog                                 | Kaggle "Fashion Product Images" (Myntra)                                                                                                    | Check the Kaggle page                     | 1 to 2 days to import | \~44K product shots tagged with gender, article type, base colour and usage (Casual / Formal / Ethnic). Use the Small set's CSV to choose 150, then pull those images at full resolution (Small images are about 60 px wide). |
| Realistic try-on (stretch)                   | [CatVTON](https://huggingface.co/zhengchong/CatVTON) through a Hugging Face Space with `gradio_client`                                      | CC BY-NC-SA 4.0, non-commercial           | 2 to 3 days           | Diffusion try-on on a model photo, under 8 GB VRAM. Public Spaces queue and rate-limit, so never on the critical demo path.                                                                                                   |

**Considered and skipped:** SkinToneClassifier (`stone`) is GPL-3.0 and still Haar-based, no better than what we have. Ready Player Me avatars shut down on Jan 31, 2026 after Netflix bought it. Polyvore-trained outfit compatibility models are Western-only and need training; our rules engine covers eastern wear and is explainable. IDM-VTON is heavier than CatVTON with the same non-commercial license.

## Architecture

&#91;embedded content: Wear Right architecture · 3 tiers\]

The browser only talks to Next.js on port 3000; Next rewrites `/api` and `/media` to Django on 8000, so there is no CORS and auth cookies just work. The Hugging Face box is the stretch try-on and can be dropped without touching anything else.

## Build plan

8 build weeks plus 2 buffer weeks, all on one laptop, no deployment. Junaid owns AI and backend, Tayyab owns frontend and admin, Hammad's team owns data, labeling, the user study and the thesis. Phase-by-phase steps, owners, gates and the API contract are in Phase playbook.

## Risks and open questions

The biggest risk is not code: it is the FYP doc's Chapter 8 and the product photos.

**Fix before defense.** Chapter 8.2 reports paired t-tests from 50 participants (t(49) = 14.2, decision time 12.5 to 3.2 minutes), while 8.1 says 5 people looked at static screens and 8.3 says no model runs yet. Those numbers have no data behind them, and an examiner reading both pages will see it. Replace them with a real study in week 8: 15 to 20 people, the same "find an outfit" task on a normal grid vs. Wear Right, timed. Also clean the template header ("Fall-2020-00, Session 2017-2020") and NFR-03's 99.9% uptime.

| Risk                              | Impact                                  | Mitigation                                                                                                                |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Inconsistent product photos       | Mannequin looks broken, demo falls flat | Seed from Kaggle flat shots; enforce front-facing plain-background uploads; rembg on every upload                         |
| Accuracy under 85% in real light  | Fails NFR-02                            | Fix the white-balance and CLAHE bugs first; reject bad light with a retake prompt; report accuracy per lighting condition |
| Most local users land in "Medium" | Everyone sees the same picks            | Use undertone + Monk 4-5 vs 6-7 inside Medium to differentiate                                                            |
| Live demo on one laptop           | Bad room light or a crash on the day    | `make demo` with pre-scanned profiles, all models and images offline, backup screen recording                             |
| Messy tags in catalog             | Outfit engine picks nonsense            | Auto-tagging prefill + required fields in admin                                                                           |

**Open questions**

- [ ] Which laptop runs the demo, and does it have the RAM for MediaPipe + FashionCLIP alongside Postgres (aim for 16 GB)?
- [ ] Does the supervisor require a "trained model"? If yes, add a small scikit-learn classifier on our own labeled LAB features (about 1 day) and present it honestly as that.
- [ ] Men's and women's wear equally, or men first?
- [ ] Who collects the 80 to 100 labeled face photos and runs the user study (suggest Hammad's team, since it is their thesis)?
- [ ] 3 tone buckets as written, or 4 (split Medium)?

## Sources

- Repo: `Wear-Right` on Junaid's machine, `main` branch, read Oct 7, 2026 (`apps/server`, `apps/client`, env files with values masked)
- FYP doc: "FYP final 1st june.pdf" in the Wear Right FYP UOL project
- [Next.js blog (16.4, Oct 6, 2026)](https://nextjs.org/blog)
- [dj-rest-auth: JWT in httpOnly cookies](https://dj-rest-auth.readthedocs.io/en/latest/guides/jwt-cookies/)
- [Fashion Product Images (Small) mirror on Hugging Face](https://huggingface.co/datasets/ashraq/fashion-product-images-small)
- [SkinToneClassifier on GitHub](https://github.com/ChenglongMa/SkinToneClassifier)
- [rembg on PyPI](https://pypi.org/project/rembg)
- [FashionCLIP model card](https://huggingface.co/patrickjohncyh/fashion-clip)
- [MakeHuman / MPFB asset license](https://static.makehumancommunity.org/about/license.html)
- [Google Research: MST-E dataset](https://research.google/blog/consensus-and-subjectivity-of-skin-tone-annotation-for-ml-fairness/)
- [CatVTON license (CC BY-NC-SA 4.0)](https://huggingface.co/camenduru/CatVTON/blob/main/README.md)
- [Ready Player Me shutdown](https://genies.com/blog/ready-player-me-shutdown)
