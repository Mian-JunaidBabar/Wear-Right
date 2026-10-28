# Plan 05: AI virtual try-on (the mannequin USP, done with a real model)

## Why

The flat SVG mannequin (plan 02) works but looks like clip art, and hand-drawn garments will never look like the
real products. The USP needs the actual product on a body. Open-source virtual try-on (VTON) models do exactly
this: given a photo of a person and a photo of a garment, they generate the person wearing that garment.

Skin tone v2 is being scaled down (plan 06), so this is **the** USP to finish properly.

## Model choice

| Model | License | Size / VRAM | Garments | Notes |
| --- | --- | --- | --- | --- |
| **FASHN VTON v1.5** (Jan 2026) — first choice | Apache-2.0 | 972M params, ~2 GB weights, "consumer GPUs"; bf16 on RTX 30xx/40xx | tops, bottoms, one-pieces | Mask-free (person + garment photo only), accepts **model photos or flat-lays as the garment**, which fits our Kaggle photos. `pip install -e .`, Python API `TryOnPipeline(...)(person_image, garment_image, category)`. |
| **CatVTON** (ICLR 2025) — fallback | CC BY-NC-SA 4.0 (fine for an academic FYP, not for selling) | 899M params, under 8 GB VRAM at 1024x768 | upper, lower, overall | Strongest garment shape in an independent comparison; needs a mask (its AutoMasker does it). |
| OmniTry | Apache LoRA on FLUX Fill (non-commercial) | 28 GB+ | any wearable incl. shoes, bags, hats | Too heavy for our machines. Not used. |
| IDM-VTON, OOTDiffusion | CC BY-NC-SA | SDXL-size, slow | tops/bottoms | Slower and weaker than the two above. Not used. |

Sources: FASHN VTON v1.5 repo (github.com/fashn-AI/fashn-vton-1.5), CatVTON repo (github.com/Zheng-Chong/CatVTON),
license survey github.com/XQ0820/open-virtual-try-on-models (checked 2026-10-19).

**Honest limits to state in the thesis:** none of the practical models dresses **shoes or accessories** (watches,
belts, caps). The try-on image shows top + bottom (or a one-piece such as a kurta/dress); shoes and accessories from
the look are shown as product chips under the image. The model is third-party; our contribution is the pipeline:
skin-tone-driven outfit selection, body presets, the try-on service, caching and the shop integration.

## Architecture

```
Next.js  ──/api/tryon/*──▶  Django (tryon app)  ──HTTP──▶  apps/tryon  (FastAPI, own venv, GPU, port 8010)
                            TryOnRender rows               loads FASHN once, one job at a time
                            media/tryon/<hash>.png
```

- **Separate service** `apps/tryon/`: torch + the VTON model must not live in the Django venv (mediapipe, rembg,
  numpy pins would clash) and must load once, not per request. FastAPI + uvicorn, one worker, a lock around the GPU.
  - `GET /health` → `{model, device, vram_gb, loaded}`
  - `POST /tryon` multipart `person` (image), `garment` (image), `category` (`tops|bottoms|one-pieces`) → PNG bytes.
  - Env: `TRYON_MODEL=fashn|catvton`, `TRYON_WEIGHTS_DIR`, `TRYON_DEVICE`.
- **Django app `tryon`** (layered like the others, `TimeStampedModel`):
  - `TryOnRender`: `key` (sha1 of body id + ordered product ids + model name, unique), `body` (e.g. `men/regular`),
    `top` FK Product null, `bottom` FK Product null, `onepiece` FK Product null, `status` (`queued|running|done|failed`),
    `image`, `error`, `duration_ms`.
  - `services.request_render(body, top, bottom, onepiece)`: return the cached row if `done`; otherwise create/reuse the
    row and submit it to a single-thread `ThreadPoolExecutor`. The job calls the service for the top (or one-piece) on
    the body image, then for the bottom on that result, saves `media/tryon/<key>.png`, and marks it done/failed.
  - API: `POST /api/tryon/renders/` `{body, top_id, bottom_id, onepiece_id}` → `{id, status, image}`;
    `GET /api/tryon/renders/<id>/` for polling. AllowAny (shop preview is public) + `ScopedRateThrottle` (20/hour per IP).
    `GET /api/tryon/status/` → is the service up.
  - Garment input: the product's original `image` (FASHN accepts model photos). Category from plan 01's `kind`/`slot`:
    top/outerwear → `tops`; bottom → `bottoms`; kurta, kameez, dress → `one-pieces` (and skip the bottom).
  - `manage.py prerender_looks --limit N`: renders the best look for the top N products per gender and all body presets,
    so the demo is instant and never waits on the GPU live.
- **Body images** `apps/server/tryon_bodies/{men,women}-{slim,regular,plus}.jpg` (6 images, 768x1024, 3:4):
  full body, front, standing straight, arms slightly away from the torso, plain light background, fitted neutral clothes.
  Source: free-licence stock photos (Pexels/Unsplash; record each URL and licence in `tryon_bodies/SOURCES.md`) or
  generated once locally. Face may be cropped at the chin for a mannequin feel if the model still behaves. No real
  people from the team.

## Web

- `OutfitPreviewModal.tsx` and `CompleteOutfitView.tsx`: the main panel becomes the try-on image.
  - While rendering: skeleton with "Dressing the model... (about N s)" and a progress shimmer; poll every 2 s.
  - Slim/Regular/Plus switch the body (new render, cached after the first time).
  - Swapping a top or bottom in the look triggers a new render (debounce 600 ms).
  - Under the image: chips for shoes and accessories in the look (photo + name), labelled "Completes the look".
  - **Fallback**: if `/api/tryon/status/` says the service is down, or a render fails, show the SVG mannequin from
    plan 02 with a small note. A tab "AI try-on | Sketch" lets the user switch. The demo must never show a blank panel.
- Admin (optional, last): Products table gets a "Pre-render try-on" action; Dashboard shows how many renders are cached.

## Hardware gate (do this before writing integration code)

Unknown yet: the team's GPU. The spike (prompt 06) answers it. Decision rule:

| Spike result | Plan |
| --- | --- |
| NVIDIA GPU, a top+bottom render in about 40 s or less | live renders + prerender for the demo |
| GPU too small / FASHN fails, CatVTON works | switch `TRYON_MODEL=catvton`, same architecture |
| CPU only or several minutes per render | prerender only (overnight `prerender_looks`), live requests show the cached render or the SVG fallback |

## Tests

- tryon service: unit test with a fake pipeline (no GPU) for the endpoints and the lock; one `@pytest.mark.models`
  test that runs the real model on the sample images (skipped without weights).
- Django: cache key stability; cached render returned without calling the service; failure recorded; category
  mapping table; throttle; prerender command with a fake client.
- vitest: polling hook stops on done/failed; fallback chosen when status is down.

## Out of scope

Shoes/accessories on the body, user's own photo upload (stretch goal only after everything else, behind a toggle),
video, multiple poses.
