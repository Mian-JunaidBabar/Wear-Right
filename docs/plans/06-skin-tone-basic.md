# Plan 06: skin tone, kept basic

## Decision

A reliable skin-tone detector depends on lighting, background, camera and white balance all at once; that is a research
project on its own. For the FYP we keep the scanner that already works (MediaPipe face landmarks, cheek/forehead
regions, Lab/ITA depth, undertone) and make it **honest and easy to correct**, instead of building "v2". The try-on
(plan 05) is the USP we finish properly.

## Tasks

1. **Capture guidance** on `/scan`: a short checklist before the camera opens (face the light, plain background, no
   filters, remove glasses), and a face-oval overlay on the live camera.
2. **Quality gate**: reject a photo that is too dark, too bright or blurry (mean brightness and Laplacian variance on the
   face region) with a clear "retake" message. Thresholds as named constants with a comment.
3. **Show the result as an estimate**: depth + undertone + a confidence word (high/medium/low from the engine's
   confidence) and the swatch; one tap "Not right? Choose mine" opens the manual picker pre-filled with the estimate.
   Whatever the user confirms is what gets saved to the profile.
4. **Small honest evaluation**: `manage.py evaluate_skin_tone --dir data/eval/` already exists. Collect 20 to 30 selfies
   from consenting friends/family, each labelled by the person themselves (Fair/Medium/Dark, warm/cool/neutral) in a
   `labels.csv`, run the command, paste the real accuracy and confusion matrix into `docs/phases/phase-7.md`. No photos
   go in git. No invented numbers.

## Out of scope

Training a classifier, white-balance correction research, colour cards.
