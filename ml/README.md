# ml — local tile recognition

Experiment to replace the Gemini photo-recognition call with a small local model.

Recognition currently takes 11–24s through the API and can fail on quota, model overload, or the
gateway timeout. The classifier here runs in **0.93ms per tile on CPU** — some 15ms of inference for a
whole hand — with none of those failure modes. Naming the tiles is the cheap half: finding them costs
more, and the last end-to-end measurement on a real photo was 699ms.

## Setup

```bash
uv venv --python 3.12
uv pip install -r requirements.txt
```

## Stages

**0. Slice the calibration photos** — done

```bash
.venv/bin/python slice_calibration.py
```

Writes 72 labelled crops — each of the 34 faces once per photo, plus the two tile backs each photo
holds — to `data/faces/`, a cut-out mask for each to `data/masks/`, and `data/faces_contact_sheet.png`
to eyeball the cut in one look. It also prints an edge audit, because every problem found in this
routine was spotted by eye first.

Getting the boxes clean took several passes — see the script docstring. Worth the effort because there
are only two source images per class, so any leftover neighbour or table is a *near-perfect* cue for
that class and the classifier will use it instead of the tile pattern.

**1. Face classifier (36 classes)** — done

```bash
.venv/bin/python synthesize.py          # sample sheets, to check the data by eye
.venv/bin/python train_classifier.py    # ~30 min on an M2 Pro
.venv/bin/python inspect_failures.py --hard
```

467k parameters, 64px input, exported to `runs/classifier.onnx` (1.9MB, single file). Trained purely
on synthetic data augmented from the 72 crops; no hand photos needed.

Two of the classes are not tile faces. `none` is for everything that is not one face: without it the
classifier is closed-set, has to answer with one of the 34, and felt, the plastic housing of the mahjong
table and a misaligned crop all come back as some tile, often above 0.8 confidence. Reading a real photo
failed on exactly that — the housing scored better than the hand — and in production it would have
written invented tiles into the score sheet. `back` is the face-down tile, which is what separates a
暗杠 from a 明杠 and so changes the score; folded into `none` that is unrecoverable.

**2. Reading a real photo** — works, and needed no trained detector

```bash
.venv/bin/python try_real_photo.py /tmp/hand.png
```

On the first real photo tried — a table the model had never seen, green felt instead of brown wood,
every tile at 90 degrees — it finds the hand, works out that there are 13 tiles, and **names all 13
correctly**. Fully automatic: no region, count or pitch supplied.

That reading was with the crops and model as they stood before the first calibration photo was re-shot,
and **has not been repeated since**: the photo itself is gone, so the current model's only real-photo
evidence is the cross-lighting check further down. Re-shooting a hand and running this is the first
thing worth doing here — `data/hand_read.png` is the previous model's annotated output to compare
against.

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
| same distribution as training | 0.9988 | 0.981 |
| every augmentation range widened | 0.9908 | 0.863 |

**These are not estimates of accuracy on a real photo.** Every image, training and evaluation alike,
derives from the same 72 crops of two calibration photographs. They measure invariance to the
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
| 0.0 | 100% | 0.9908 | 0.863 |
| 0.5 | 98.1% | 0.9958 | 0.934 |
| **0.8** | **92.0%** | **0.9992** | **0.987** |
| 0.9 | 81.1% | 0.9997 | 0.995 |

So a threshold of 0.8 answers eleven tiles in twelve and is essentially never wrong on those.
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

There are two mahjong tables and a set of tiles for each, with a calibration photo of each set. Both
lay the whole set out the same way — four butted columns of nine, the tiles a quarter turn over, seven
honours and two tile backs filling the last column — so one routine slices both, and every class has
two appearances rather than one.

What the two photos do *not* share is the arrangement or the light. One runs its numbers down the
column, the other up; one orders its honours 東西南北白發中 and the other 東南西北中發白, so the canonical
order is not a safe guess for either. Nor is one threshold obviously going to fit both: the brown
photo's surroundings sit at L 66 with a chroma of 24, the green one's at L 32 and chroma 8, and each
photo carries a tile back that is nothing like a face — one of them at L 124 with a chroma of 48,
further from grey than the felt around it. One face threshold does cover both (L above 150, chroma
below 30); the coloured back needs a per-photo exception.

Neither the layout nor the labels are assumed anywhere. Both were read back by having the classifier
name all 36 cells of a photo and checking the answer is a legal permutation of the set — each of the 34
faces exactly once, plus the backs. That is also how a re-shot photo should be settled.

### Cross-lighting generalisation, measured

`system_mahjong_calibration.jpg` was re-shot partway through this work: a new photo of the same set,
under different light, in a different layout, with that set's tile backs added. That makes an unusually
clean test, because a classifier trained before the swap had never seen any of it.

It named **34 of 34 faces correctly**, at 0.67 to 0.97 confidence, and returned `none` for both tile
backs — which is right, since the set it was trained on had no back of its own. It also settled the
honours as 東西南北白發中, which is not the canonical 東南西北 and would have been mislabelled by guessing.

So the answer to whether one lighting condition transfers to another is yes, on the evidence available.
The earlier direction was checked the same way and agreed on 32 of 36, its four disagreements all low
confidence and all bad crops rather than wrong labels.

Set 2 also settles a smaller question. Its 3m is placed upside down, and the model read it at 0.95
anyway — orientation is trained out, since all four quarter turns of a face are one class. That is
also why a photo whose every tile lies at 90 degrees reads correctly.

## Known weak spots

The 萬 suit, where the difference between faces is a stroke count: on the widened split the confusions
are `2m->1m`, `3m->2m` and back again. Those come with low confidence, which is why the threshold above
works.

`back->none` also appears, which is new — the two sets' backs are four quite different images (two
colours, two lightings) under one label, and it is the class with the least to go on.

發 (6z) read at 0.34-0.53 on the one real hand photo tried, correct but under any sensible threshold.
Green ink on an off-white tile under green felt is the least well covered part of the synthetic
distribution. **Unverified against the current model** — see the note in stage 2.
