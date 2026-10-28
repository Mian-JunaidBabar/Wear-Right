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

## Hardware reality (decided 2026-10-28)

The team laptop is a Dell Precision 5540: Quadro T1000 **4 GB** (Turing), i7-9850H, 16 GB RAM, ~140 GB free on Linux.

- Turing has no bf16. FASHN v1.5 then falls back to float32: ~972M params x 4 bytes is ~3.9 GB for the weights alone,
  plus the pose and parsing models. It will not fit in 4 GB. CatVTON in fp16 (~1.8 GB of weights) with attention
  slicing / CPU offload *might* fit, but slowly (expect minutes per image, measure it).
- CPU-only diffusion on the i7 is in the range of many minutes per garment. Not usable live.

**So the laptop never generates images during the demo.** Renders are made in batches on a free cloud GPU and
imported into the app as files. At runtime the app only serves cached images; the GPU is not needed on demo day.

| Where | What it is for |
| --- | --- |
| **Kaggle Notebooks (free GPU, T4/P100 16 GB, weekly quota; check the current hours on kaggle.com)** — primary | Batch rendering of every look we want to show. Long sessions, files in/out as datasets, no credit card. |
| Google Colab free T4 — backup | Same notebook if Kaggle quota runs out. Sessions can drop, so keep batches small and resumable. |
| The laptop (CatVTON fp16 + offload) — optional | One-off renders while developing, only if the spike shows it works at all. |
| Live service over a tunnel from Kaggle/Colab — not for the demo | Allowed for experiments only; never on the critical path. |

### Batch pipeline (replaces "live renders" as the main mode)

1. `manage.py export_tryon_batch --products <ids|demo> --presets regular[,slim,plus] --out tryon_batch.zip`:
   for each chosen anchor product, take the look the recommender builds (best pick + the 2 swaps for top/bottom),
   expand it into render jobs (body x top/onepiece x bottom), drop jobs already rendered, and write `jobs.json`
   (key, body, garment file names, categories) plus the body and garment images into the zip.
2. `apps/tryon/batch_render.py` (runs on Kaggle/Colab; same code as the service's pipeline wrapper): reads `jobs.json`,
   renders each job (top or one-piece first, then bottom on the result), writes `results/<key>.png` and `results.json`
   (key, seconds, error). Resumable: skips keys already in `results/`. A notebook `apps/tryon/notebooks/batch_render.ipynb`
   is just: install, download weights, unzip the batch, run the script, zip `results/`.
3. `manage.py import_tryon_results results.zip`: creates/updates `TryOnRender` rows as `done` with the image, or `failed`
   with the error. Idempotent.
4. Size the batch to the demo: about 40 "hero" products the demo script uses, their best look and swaps, regular body
   for all and slim/plus only for the hero anchors. Roughly a few hundred renders; at the spike's measured seconds per
   render that should fit in one or two Kaggle sessions. The spike must report the real number.

### Runtime behaviour

- `GET /api/tryon/renders/?body=&top=&bottom=&onepiece=` → the cached render if it exists, else `404`.
- Web: if a cached render exists for the current look and preset, show it. If not (the shopper swapped to an unrendered
  combination), show the SVG mannequin with a small note "AI try-on is available for the recommended looks" and a button
  "Back to the recommended look". The live POST/queue path stays in the code but is used only when `TRYON_SERVICE_URL`
  is set and `/health` answers.

## Architecture (service code, shared by batch and optional live mode)

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

## Model decision rule (from the spike on Kaggle)

| Spike result on a Kaggle T4/P100 | Use |
| --- | --- |
| FASHN v1.5 installs, runs, and 4 of 5 test garments look right | FASHN (`TRYON_MODEL=fashn`) |
| FASHN fails or looks wrong, CatVTON looks right | CatVTON (`TRYON_MODEL=catvton`) |
| Both poor on our catalog photos | stop and report with the images; the lead decides (e.g. only clean flat-lay products get try-on) |

Laptop check (same spike): does CatVTON fp16 + offload run on the T1000 at all, and how many seconds per render.
This only decides whether local one-off renders are possible; the demo does not depend on it.

## Tests

- tryon service: unit test with a fake pipeline (no GPU) for the endpoints and the lock; one `@pytest.mark.models`
  test that runs the real model on the sample images (skipped without weights).
- Django: cache key stability; cached render returned without calling the service; failure recorded; category
  mapping table; throttle; prerender command with a fake client.
- vitest: polling hook stops on done/failed; fallback chosen when status is down.

## Out of scope

Shoes/accessories on the body, user's own photo upload (stretch goal only after everything else, behind a toggle),
video, multiple poses.
