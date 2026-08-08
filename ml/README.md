# ml — local tile recognition

Experiment to replace the Gemini photo-recognition call with a small local model.

Recognition currently takes 11–24s through the API and can fail on quota, model overload, or the
gateway timeout. The classifier here runs in **0.93ms per tile on CPU** — about 15ms for a whole
hand — with none of those failure modes.

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
`data/faces_contact_sheet.png` to eyeball the cut in one look. It also prints an edge audit, because
every problem found in this routine was spotted by eye first.

Getting the boxes clean took several passes — see the script docstring. Worth the effort because
there is only one source image per class, so any leftover neighbour or table is a *perfect* cue for
that class and the classifier will use it instead of the tile pattern.

**1. Face classifier (34 classes)** — done

```bash
.venv/bin/python synthesize.py          # sample sheets, to check the data by eye
.venv/bin/python train_classifier.py    # ~11 min on an M2 Pro
.venv/bin/python inspect_failures.py --hard
```

467k parameters, 64px input, exported to `runs/classifier.onnx` (1.9MB, single file). Trained purely
on synthetic data augmented from the 34 crops; no real photos needed.

**2. Tile detector (1 class)** — needs real photos, now accumulating on the server.

**3. Spatial logic** — concealed vs melds, meld grouping, 暗杠, winning tile. Gemini does this today
via the prompt; a local model needs it written out.

## Results

Per tile, and the same figure raised to the 16th power, since a hand is about 16 tiles and every one
has to be right:

| split | per tile | per hand |
| --- | --- | --- |
| same distribution as training | 0.9989 | 0.983 |
| every augmentation range widened | 0.9882 | 0.828 |

**These are not estimates of accuracy on a real photo.** Every image, training and evaluation alike,
derives from the same 34 crops of one calibration photograph. They measure invariance to the
augmentations in `synthesize.py` and say nothing about the ways a real photo will differ that were
not thought of. The widened split is the closest available proxy and is still a proxy. The real
number comes from stage 2's photos.

### Abstaining beats guessing

The deployable figure is not raw accuracy but how much the model can answer while being right nearly
always. A wrong tile is written into the score sheet and quietly changes the result; a tile the model
declines to name can be handed back to the user, or to Gemini.

On the widened split:

| confidence ≥ | answered | per tile | per hand |
| --- | --- | --- | --- |
| 0.0 | 100% | 0.9882 | 0.828 |
| 0.5 | 97.0% | 0.9976 | 0.962 |
| **0.8** | **88.6%** | **0.9996** | **0.993** |
| 0.9 | 72.6% | 0.9999 | 0.998 |

So a threshold of 0.8 answers seven tiles in eight and is essentially never wrong on those.
(Confidence saturates near 0.95 because of the label smoothing, so thresholds above that are not
meaningful.)

### What the failures turned out to be

Two findings from looking at them rather than tuning against the number:

- **Resolution is not the bottleneck.** 96px scored the same as 64px to within noise, so the 萬 suit
  is not being lost to downsampling.
- **Most early failures had unrecoverable labels.** Cropping a few percent into a tile removes the
  numeral on a 萬 face, which sits at the very top edge, and 1m 2m 3m become the same image. That was
  label noise, not hard examples. Tightening the crop and occlusion ranges moved the widened split
  from 0.9799 to 0.9882 per tile, and per hand from 0.723 to 0.828.

What remains is genuinely the 萬 suit — `2m->1m`, `3m->2m` — where the difference is a stroke count.
Those failures come with low confidence, which is why the threshold above works.

## Prerequisites still open

- **No real photos yet in hand.** `#162` is deployed and collecting into the `mahjong-samples`
  volume; stage 2 needs a few dozen.
- **No tile-back photo.** Not in the calibration set (`7z` is the blank frame, not a back). Needed as
  a 35th class for 暗杠. Drop one in `data/` and re-run stage 0.
