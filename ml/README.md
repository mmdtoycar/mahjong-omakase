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

**1. Face classifier (35 classes)** — done

```bash
.venv/bin/python synthesize.py          # sample sheets, to check the data by eye
.venv/bin/python train_classifier.py    # ~11 min on an M2 Pro
.venv/bin/python inspect_failures.py --hard
```

467k parameters, 64px input, exported to `runs/classifier.onnx` (1.9MB, single file). Trained purely
on synthetic data augmented from the 34 crops; no real photos needed.

The 35th class is `none`, for everything that is not one tile face. Without it the classifier is
closed-set: it has to answer with one of the 34, so felt, the plastic housing of the mahjong table and
a misaligned crop all come back as some tile, often above 0.8 confidence. Reading a real photo failed
on exactly that — the housing scored better than the hand — and in production it would have written
invented tiles into the score sheet.

**2. Reading a real photo** — works, and needed no trained detector

```bash
.venv/bin/python try_real_photo.py /tmp/hand.png
```

On the first real photo tried — a table the model had never seen, green felt instead of brown wood,
every tile at 90 degrees — it finds the hand, works out that there are 13 tiles, and **names all 13
correctly**. Fully automatic: no region, count or pitch supplied.

The staged plan assumed this needed a trained detector and a few dozen labelled photos. It does not.
A hand is a line of butted tiles, bright and nearly colourless against strongly coloured felt, so
finding candidate lines is a thresholding problem; and the grid within a line is found by sweeping
start and pitch and keeping whatever the classifier is most confident about. A misaligned crop is half
of one tile and half of the next, which the classifier is not confident about, so its own confidence
is the alignment signal.

**3. Spatial logic** — concealed vs melds, meld grouping, 暗杠, winning tile. Gemini does this today
via the prompt; a local model needs it written out.

## Results

Per tile, and the same figure raised to the 16th power, since a hand is about 16 tiles and every one
has to be right:

| split | per tile | per hand |
| --- | --- | --- |
| same distribution as training | 0.9996 | 0.994 |
| every augmentation range widened | 0.9912 | 0.869 |

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
| 0.0 | 100% | 0.9912 | 0.869 |
| 0.5 | 98.2% | 0.9960 | 0.938 |
| **0.8** | **92.2%** | **0.9989** | **0.982** |
| 0.9 | 80.5% | 0.9995 | 0.993 |

So a threshold of 0.8 answers seven tiles in eight and is essentially never wrong on those.
(Confidence saturates near 0.95 because of the label smoothing, so thresholds above that are not
meaningful.)

### The synthetic numbers and the real photo moved in opposite directions

Worth recording, because it is the clearest evidence that the table above is not a deployment
criterion. Giving each epoch its own augmentation seeds — the training set had been re-drawing the
same 14k images every epoch — lifted the widened split from 0.9858 to 0.9912 per tile, and per hand
from 0.796 to 0.869.

On the one real photo, the same change left the reading correct at 13 of 13 and **lowered the
confidences**: tiles at or above 0.8 went from 6 of 13 to 4 of 13. More augmentation variety makes the
model less sure of itself, which is better calibration on synthetic data and, here, worse coverage on
the only real data there is. Nine tiles handed back instead of seven is worse to use.

Neither figure is wrong. They measure different things, and only the second one is about photographs.

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

## The two tile sets

There are two mahjong tables and a set of tiles for each, and
`system_mahjong_calibration_2.jpg` is the second — on green felt, laid out as four columns rather
than four rows, and including one tile back of each colour.

Whether a classifier trained on the first set reads the second was checked directly, by having it
predict all 36 tiles of the second photo. It agreed on 32. All four disagreements were low confidence
and came from bad crops rather than wrong labels: three were the tile at the top of a column, where
the crop caught a swathe of felt and the model correctly answered `none`. Both tile backs also came
back `none`, which is what they should be.

Set 2 also settles a smaller question. Its 3m is placed upside down, and the model read it at 0.95
anyway — orientation is trained out, since all four quarter turns of a face are one class. That is
also why a photo whose every tile lies at 90 degrees reads correctly.

Still to do: fold set 2's crops into training, so every class has two appearances rather than one and
the model is pushed toward the pattern rather than the finish of one particular set.

## Known weak spot

發 (6z) reads at 0.34-0.53 on the real photo — correct, but under any sensible threshold it would be
handed back. Green ink on an off-white tile under green felt is the least well covered part of the
synthetic distribution. Adding felt-coloured backgrounds helped the rest and not this.
