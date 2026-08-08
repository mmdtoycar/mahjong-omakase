# ml — local tile recognition

Experiment to replace the Gemini photo-recognition call with a small local model.

Recognition currently takes 11–24s through the API and can fail on quota, model overload, or the
gateway timeout. A local detector would run in well under a second with none of those failure modes.

## Setup

```bash
uv venv --python 3.12
uv pip install -r requirements.txt
```

## Stages

**0. Slice the calibration photo** — done

```bash
.venv/bin/python slice_calibration.py
```

Writes 34 labelled tile faces to `data/faces/`, a cut-out mask for each to `data/masks/`, and
`data/faces_contact_sheet.png` to eyeball the cut in one look.

Getting the boxes clean took several passes — see the script docstring. Worth the effort because
there is only one source image per class, so any leftover neighbour or table is a *perfect* cue for
that class and the classifier will use it instead of the tile pattern.

**1. Face classifier (35 classes)** — synthetic data augmented from the 34 crops. Needs no photos.

**2. Tile detector (1 class)** — needs real photos, currently being collected.

**3. Spatial logic** — concealed vs melds, meld grouping, 暗杠, winning tile. Gemini does this today
via the prompt; a local model needs it written out.

## Accuracy bar

A hand is ~16 tiles, so per-tile accuracy compounds: 99% per tile is only 85% per hand. The target
is 99.9% per tile. Below that this is worse than the API, because a wrong tile gets saved into the
score sheet while a failed read just shows an error.

## Prerequisites

- **No real photos yet.** `#162` is merged but needs a redeploy before samples start accumulating in
  the `mahjong-samples` volume.
- **No tile-back photo.** Not in the calibration set (`7z` is the blank frame, not a back). Needed as
  the 35th class for 暗杠. Drop one in `data/`.
