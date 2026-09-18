# Reading a row of mahjong tiles from a phone photo: where I'm stuck

I'd like a second opinion on a computer-vision problem. Below is the pipeline, what works, exactly where it
fails, and — importantly — a list of things I have already tried with the measured cost of each, so you can
skip them. I'm interested in ideas that aren't on that list, or in being told that one of the rejected ideas
was rejected for the wrong reason.

## The task

A mahjong score-tracking app. A player photographs their own hand at the end of a round and the app fills in
the tiles so they don't have to tap 14 of them in. Today this calls Gemini, which takes 11–24s and sometimes
fails on quota or timeout. I'm replacing it with a local model: currently ~800ms per photo on a laptop CPU,
running as a small Python HTTP sidecar next to a Java server.

A hand is a row of 13 or 14 tiles standing in a line, plus 0–4 "melds" (sets of 3–4 tiles) laid aside a
little apart from the row. Total tiles = 14, or 13 if the winning tile isn't laid down, and each meld takes
exactly 3 tiles out of the standing row, so with m melds the row holds 14−3m or 13−3m tiles.

Photos are taken by hand from the player's seat, so the row is seen obliquely: the faces recede and the row
appears as a trapezoid whose apparent depth changes along its length. The photo may be at any of four
rotations. Tiles within a row are butted together with no gaps.

## The pipeline

1. Shrink to 900px on the long side.
2. Two binary masks: bright-and-low-chroma pixels, and the convex hull of the largest coloured-and-dark
   component (the felt) minus the felt itself. Each finds rows the other loses; together they locate 39 of 44
   sample rows.
3. Connected components filtered by aspect ≥ 2 and area ≥ 0.5% of frame → candidate "runs".
4. For each blob, fit its two long boundaries as **independent** straight lines (least squares with outlier
   trimming) and cut the ends where the blob stops being as deep as the row → a quadrilateral. Independent on
   purpose: constrain them parallel and the quad is a rectangle, and a rectangle has one depth for the whole
   row, which is the one thing a photographed row is not.
5. Warp the quad to an upright rectangle (a plane-to-plane homography). The tiles now run across it at a
   constant pitch by construction.
6. For each allowed tile count, up to 3 candidate grids: a pitch from a periodic fit of the lightness profile,
   `length/count`, and `(length − offset)/count`. Each is required to have pitch/depth in 0.55–1.05.
7. Refine each with 3 pitch nudges (±1%) × 3 offset nudges (±4% of a pitch).
8. Cut each grid into cells and classify all of them.
9. **Score a reading by the mean top-1 confidence over its cells.** Among readings within 0.05 of the best,
   take the one with the most cells.
10. Meld count: for m = 0…4, allowed row lengths are (14−3m, 13−3m); take the first m for which some run fits
    one of those lengths and at least m other runs have a 3- or 4-cell candidate.
11. Cut the final cells from the original-resolution photo through the same homography. This alone took
    per-tile accuracy from 71% to 91%: the search wants a small image, the classifier wants a large one.
12. Refuse rather than guess: more than 18 tiles, more than 2 face-down tiles standing, more than 4 of one
    tile, or half the row below 0.8 confidence.

The classifier is a 467k-parameter CNN, 64px input, 36 classes (34 tile faces, `back` for a face-down tile,
`none` for anything that is not one tile face). **Trained purely on synthetic data** augmented from 88
hand-cut crops; it has never seen a photograph.

## Ground truth

44 photos of real hands, the hand known exactly for each (the app recorded it on the score sheet). On top of
that I hand-marked, in a click tool: the 4 corners of the standing row and of each meld (66 quadrilaterals),
the tiles in **photo order** (the score sheet's order is sorted, so it can't give position), and which cell if
any holds a tile laid on its side. That is ~596 labelled tile positions and hence **~530 interior tile
boundaries** whose position I know exactly in the rectified strip. The pipeline uses none of them.

4 of the 44 photos are on a "should refuse" list, confirmed by the photographer: shot from too far to one
side, or with the tiles not laid straight enough to read by eye either.

## Where it stands, and the ceiling

| | tiles | photos read whole |
|---|---|---|
| the pipeline as it ships | 390/561 (69.5%) | **15 of 40** |
| classifier alone, cut from hand-marked corners at the known count | 508/542 (93.7%) | **25 of 40** |

So there are **10 photos of headroom between having a correct region and giving an answer**, and the causes
are known, photo by photo: on 3 the meld count comes out too low so the row is asked for 13/14 when it holds
11; on 1 the row's length is off by one within the allowed pair; 2 are three-meld hands the count search never
reaches; the rest are the classifier's own errors.

## The single most valuable thing in the system

Cut from the same hand-marked corners with the count given:

| geometry | tiles correct |
|---|---|
| four-point homography | 541/596 (90.8%) |
| tightest rotated rectangle around those corners | 391/596 (65.6%) |
| upright bounding box | 379/596 (63.6%) |

Undoing the rotation is worth 2 points; undoing the **perspective** is worth 25. End to end, replacing the
homography with a rotated rectangle takes the system from 390 tiles / 15 photos to 160 / 1.

## Perfect regions do not help — this is the surprising bit

I replaced the mask-found regions with the hand-marked quadrilaterals — perfect corners, perfect perspective,
and the row already separated from its melds — and let everything downstream run unchanged:

| region from | tiles | photos whole |
|---|---|---|
| the masks, as it ships | 348/561 | 13 |
| the hand-marked corners | 308/561 | 12 |

Perfect regions are slightly *worse*. Two more oracles, same shape of answer: giving the pipeline the **true
tile count** makes it worse (misreads 8 → 13, because the count is then forced onto whatever region was
chosen); giving it the **true meld count** changes nothing.

## What I think the problem is

The pipeline usually *generates* the correct cut among its candidates and fails to rank it first. Mean top-1
confidence cannot tell an aligned grid from a misaligned-but-confident one, and it rises monotonically as
cells are dropped, so it prefers a 13-cell reading of a 14-tile row — which reads 13 tiles correctly and
silently loses the 14th.

The evidence is that **every** extra candidate offered to the ranker makes things worse. Against 390 tiles /
15 photos:

| change | result |
|---|---|
| widen the pitch and offset nudges | 293–318 tiles |
| add a candidate flush against the far end | 374 tiles, 12 photos |
| add candidates shifted a whole cell either way | 331 tiles |
| cut one cell wider for a tile laid on its side | 339 tiles, 13 photos, 2.6× the time |

And every alternative objective is flat or worse:

| objective | result |
|---|---|
| mean top-1 confidence (current) | 390 tiles, 15 whole |
| mean confidence − mean P(none) | 356 |
| mean confidence × (1 − P(none)) | 375 |
| worst cell's confidence | 303 |
| geometric mean of confidence | 365 tiles, 15 whole |
| log confidence − log P(none) | 310 |
| reject any reading with a cell over 0.4 P(none) | 370 tiles, 15 whole |

Same for choosing the meld count: "the fewest that holds" beats scoring by mean confidence (339/353), by
whether each candidate reads as a valid meld (339), and by the share of the row's cells left in doubt (365).

## Already measured and rejected — please don't re-suggest these

- **Train a model to find where the tiles are.** The oracle rules it out: perfect regions are worse than the
  masks. Region finding has not been the bottleneck for a while.
- **Estimate the camera pose / calibrate the table plane** (vanishing points from the table rails, monocular
  depth, Perspective Fields, and so on). The four-point homography already undoes the perspective for the
  region it is given, and doing it perfectly buys nothing.
- **Split a region that spans the row and its melds at the gap.** The clean sub-regions mostly already exist
  as separate candidates (41 of 59 marked regions found as-is; splitting at coverage gaps recovers 1 more).
  Where the row and melds are close there is genuinely no gap: tile-mask coverage along the strip never drops
  below 0.52.
- **Count the melds from the number of separate tile regions.** Right on 6 of 40 photos, over by 1–3 on the
  rest, because the candidates include the table's plastic housing, the discard pile and arms.
- **Compare a meld's pitch to the row's pitch** ("same tiles, same camera"). Over the 22 marked melds the
  ratio runs **0.62 to 2.18** (median 1.08), because a meld with its called tile laid on its side is much
  wider per tile and may be laid nearer or further than the row. The check that assumed this cost 50 tiles.
- **Lower the confidence gate so fewer photos are refused.** Sweeping the whole-photo gate from 0.8 to 0.0
  yields **zero** additional photos read whole; refusals just become misreads. The classifier's confidence is
  honest, incidentally: on hand-marked cells, 0.2–0.3 is 48% accurate, 0.4–0.5 is 68%, above 0.7 it is 98%+.
- **Trim more of each cell's edge before classifying** (the reference cut that reads 93.7% trims 8px where the
  pipeline trims 4). Sweeping absolute values: 4px is optimal, 8px gives 277 tiles. Sweeping proportionally
  (a share of the cell, which is the tidier idea since the same grid is cut at two very different scales):
  worse at every share, 387 at 3% down to 100 at 12%.
- **Detect "shot from too far to one side" and tell the photographer.** The signal exists on the hand-marked
  corners — tile width / row depth is 0.66–0.92 on readable rows and 0.37–0.55 on the four that should be
  refused — but cannot be computed at runtime, because it needs the tile's width, which needs the count,
  which is the thing that just failed. From what *is* available at runtime the four land at 0.40, 0.49, 0.59
  and 1.11, straddling the readable photos completely.

## The melds, separately

Of the 19 melds on the readable photos: **13 have no region of their own** (butted against the row — the
photographer has confirmed these are photographs to refuse, not bugs to fix); **5 are separated and get
read**, 3 of them *correctly*, then blocked by a confidence gate; **1 reads correctly and is reported**.

Raising those gates doesn't help end to end: whenever the row's own region overlaps the meld, the row already
reports the meld's tiles as part of itself, so reporting the meld again puts 5 or 6 of one tile in the hand
and the whole photo is refused as impossible.

## My questions

1. **Is the classifier the real limit and am I blaming the geometry?** It reads 93.7% of tiles when cut from
   hand-marked corners at the known count, and a photo needs every tile right — 0.937^14 = 40%, against the
   25/40 = 62% of photos that are actually whole under those conditions, so the errors are correlated rather
   than independent, but the per-tile rate is clearly the binding constraint on the ceiling itself. It has
   only ever seen synthetic data. Should I be fine-tuning it on the ~596 real crops I now have instead of
   working on the geometry? Its errors are structured, not random: `1m` acts as a sink class (7m→1m, 2m→1m,
   4m→1m, 5m→1m, 3m→1m, 8m→1m, 2p→1m) and `2z` fails in a cluster (2z→1s twice, 2z→back twice). Does that
   pattern suggest a training-data problem, a class-imbalance problem, or something else?

2. **How would you rank a candidate cut?** The information I'm not using is where the tile boundaries are; I
   have ~530 hand-labelled boundaries in the rectified frame. I previously compared six 1-D signals along the
   strip against them: lightness at the row's edge gets 83% recall at 2.3× spurious; gradient formulations
   get 52–66% at 0.5–0.9× spurious; lightness spread down the column gets 31%. Pruning the high-recall marks
   by a gradient response trades recall linearly. Is a small learned 1-D boundary detector the right move, or
   would you train something to score a *whole cut* instead of finding individual boundaries?

3. **Is there a way to make the tile count fall out of the geometry** rather than being searched over? The
   row's width and depth are known and a tile's true aspect ratio is fixed, but the measured tile-width /
   row-depth ratio ranges 0.37–0.92 across photos because it depends on the camera's elevation, so it can't
   be inverted for a count. Is there a projective invariant of a row of identical butted rectangles that
   would give the count directly?

4. **Am I wrong that perfect regions don't help?** That measurement is load-bearing for everything above and
   it is counter-intuitive. The hand-marked corners are clicked by a human on a ~1100px view of the original
   photo, so they carry a pixel or two of error and may include a sliver of felt at the ends. Could that be
   enough to explain them losing to the masks, and how would you test it cleanly?

Question 1 is the one I'd most like a view on, because if the classifier is the ceiling then most of the above
is rearranging deck chairs.
