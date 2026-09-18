"""Checks the reader's decisions against numbers rather than images.

The meld path has never been run against a photograph of a real 副露 or 暗杠, because none has been taken.
Until one is, this is the only thing between a change to judge_meld and a silently wrong score. Checking it
against numbers means it cannot tell whether a real 暗杠 would be *found* in a photo — only that every
decision made once one is found is the right one. The confidences below are not invented: the 暗杠 case
carries the worst pair of tile backs actually measured, 0.63 and 0.67 with 32% and 27% not-a-tile, which is
the combination that used to be discarded.

The reading-direction cases are the exception and do use images, because there is nothing to assert about
`rail_side` except what it makes of pixels. They are drawn, not photographed — see `table`.

Run it with `python -m tests.test_reader` from `ml`, or every check at once with `python -m tests.check`.
"""

import sys

import numpy as np

from recognition.reader import (
    BACK,
    MELD_FACE_FLOOR,
    Candidate,
    Meld,
    choose_meld,
    judge_meld,
    reading_order,
)


def self_check() -> int:
    good = 0.93
    # Either side of the floor a meld's face-up cells have to average, so the two cases below go opposite
    # ways and neither is a round number picked to pass.
    over, under = MELD_FACE_FLOOR + 0.1, MELD_FACE_FLOOR - 0.1
    cases = [
        # The regression this was written for. Both the old gates rejected this: 0.63 < 0.8, and 0.32
        # over the not-a-tile limit of 0.3.
        (
            "暗杠, worst real backs",
            ["5p", "5p", BACK, BACK],
            [good, 0.94, 0.63, 0.67],
            [0.01, 0.01, 0.32, 0.27],
            Meld("gang", ["5p"] * 4, False),
        ),
        ("明杠", ["7s"] * 4, [good] * 4, [0.01] * 4, Meld("gang", ["7s"] * 4, True)),
        ("碰", ["2z"] * 3, [good] * 3, [0.01] * 3, Meld("ke", ["2z"] * 3, True)),
        (
            "吃",
            ["3m", "4m", "5m"],
            [good] * 3,
            [0.01] * 3,
            Meld("shun", ["3m", "4m", "5m"], True),
        ),
        # Three turned over leaves one face-up tile deciding a whole gang. Refused on shape, which is
        # what keeps the looser rule for backs from being a way in.
        ("three backs", ["5p", BACK, BACK, BACK], [good, 0.9, 0.9, 0.9], [0.01] * 4, None),
        ("backs, faces disagree", ["5p", "6p", BACK, BACK], [good, good, 0.9, 0.9], [0.01] * 4, None),
        # The floor is on the mean of the face-up cells, so these two go opposite ways at the same weakest
        # cell: agreement between crops is evidence, and the weakest-cell rule could not use it.
        (
            "one weak face, the rest sure",
            ["5p", "5p", BACK, BACK],
            [good, under, 0.9, 0.9],
            [0.01] * 4,
            Meld("gang", ["5p"] * 4, False),
        ),
        ("every face uncertain", ["5p", "5p", BACK, BACK], [under, under, 0.9, 0.9], [0.01] * 4, None),
        ("碰 nobody could read", ["2z"] * 3, [under] * 3, [0.01] * 3, None),
        ("碰 barely read", ["2z"] * 3, [over] * 3, [0.01] * 3, Meld("ke", ["2z"] * 3, True)),
        # A back has to beat `none`, and this one does not — a patch of felt rather than a tile.
        (
            "back is likelier nothing",
            ["5p", "5p", BACK, BACK],
            [good, good, 0.2, 0.9],
            [0.01, 0.01, 0.7, 0.01],
            None,
        ),
        ("face-up is nothing", ["1p"] * 3, [good] * 3, [0.5, 0.01, 0.01], None),
        ("three tiles, no meld", ["1m", "9p", "1z"], [good] * 3, [0.01] * 3, None),
        # 吃 needs one suit and three consecutive ranks; neither of these is a meld.
        ("same suit, not consecutive", ["1m", "3m", "5m"], [good] * 3, [0.01] * 3, None),
        ("consecutive, mixed suits", ["3m", "4p", "5s"], [good] * 3, [0.01] * 3, None),
    ]
    failures = 0
    for name, tiles, confidence, nothing, expected in cases:
        got = judge_meld(tiles, confidence, nothing)
        ok = got == expected if expected else isinstance(got, str)
        failures += not ok
        shown = got if not isinstance(got, str) else f"rejected: {got}"
        print(f"  {'ok  ' if ok else 'FAIL'} {name:26s} -> {shown}")

    # And the choice between readings of the same run. Two things are being checked here.
    #
    # A three-tile 碰 also fits four cells, at three quarters of the true pitch, and read that way it comes
    # back ['2z'] * 4 — a *valid* 杠 by shape, which would be reported and scored as one. Shape cannot separate
    # them and neither can confidence, which is why the four-cell reading is given the higher score. What
    # separates them is cell width against the run's depth: only one of the two is a tile's width.
    #
    # And melds are set aside in a line with no gap between them, so a run often holds several. Six cells that
    # divide into two 碰 are two melds; six that divide into nothing that is a meld are not.
    depth = 100.0
    valid = Candidate(0.90, 77.0, ["2z"] * 3, [good] * 3, [0.01] * 3)
    over_fine = Candidate(0.97, 57.75, ["2z"] * 4, [good] * 4, [0.01] * 4)
    not_a_meld = Candidate(0.99, 77.0, ["1m", "9p", "1z"], [good] * 3, [0.01] * 3)
    two_melds = Candidate(0.90, 77.0, ["2z"] * 3 + ["3m", "4m", "5m"], [good] * 6, [0.01] * 6)
    no_split = Candidate(0.90, 77.0, ["2z", "3m", "9p", "1z", "5s", "7p"], [good] * 6, [0.01] * 6)
    ke = Meld("ke", ["2z"] * 3, True)
    choices = [
        ("a 碰 cut as a 杠", [over_fine, valid], [ke]),
        ("higher score, not a meld", [not_a_meld, valid], [ke]),
        ("two melds in one run", [two_melds], [ke, Meld("shun", ["3m", "4m", "5m"], True)]),
        ("six cells, no way to split", [no_split], []),
        ("only the wrong shape", [not_a_meld], []),
        ("nothing fitted at all", [], []),
    ]
    for name, candidates, expected in choices:
        got = choose_meld(candidates, depth)
        ok = got == expected
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name:26s} -> {got or 'nothing'}")

    # And which way round the run reads. Boxes are (x, y, w, h). The hand is 700 long and 100 across.
    across = (300, 100, 100, 700)  # lies up the frame
    along = (100, 300, 700, 100)  # lies across the frame

    def table(rail: str | None) -> np.ndarray:
        """Green felt with the housing right up against the row, or none of it — see rail_side.

        Butted against it on purpose: the convention is that the hand is pushed up to the edge, and the
        band rail_side samples is the one immediately outside the row.
        """
        felt = np.full((1000, 1000, 3), (40, 110, 40), np.uint8)  # strongly coloured
        grey = (95, 95, 95)  # the housing: no colour to speak of, and lighter than the felt
        if rail == "above":
            felt[:300] = grey
        elif rail == "below":
            felt[400:] = grey
        elif rail == "left":
            felt[:, :300] = grey
        elif rail == "right":
            felt[:, 400:] = grey
        return felt

    open_felt = table(None)
    orders = [
        # A meld past the far end means the run already finishes at the right end. The melds decide
        # whatever the edge says, so these run on open felt.
        ("melds past the end", open_felt, across, [(300, 850, 100, 220)], (False, True)),
        ("melds past the start", open_felt, across, [(300, 30, 100, 220)], (True, True)),
        # The discard pile in the real photo is also a run of four, sitting off to the side. Letting any
        # blob vote would point the wrong way, so out-of-line boxes are ignored.
        ("off to the side, ignored", open_felt, across, [(900, 30, 100, 220)], (False, False)),
        (
            "side blob plus a real meld",
            open_felt,
            across,
            [(900, 30, 100, 220), (300, 850, 100, 220)],
            (False, True),
        ),
        # No melds: the table's edge gives the seat, and the seat gives the direction.
        ("no melds, housing below", table("below"), along, [], (False, True)),
        ("no melds, housing above", table("above"), along, [], (True, True)),
        ("no melds, housing left", table("left"), across, [], (False, True)),
        ("no melds, housing right", table("right"), across, [], (True, True)),
        # Out on open felt neither side is the housing, and guessing here is how a wrong winning tile
        # reaches the calculator — 14 of the 35 marked rows would have been guessed wrong.
        ("no melds, no edge either way", open_felt, along, [], (False, False)),
    ]
    for name, photo, hand, meld_boxes, expected in orders:
        got = reading_order(photo, hand, meld_boxes)
        ok = (got.reverse, got.known) == expected
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name:28s} -> reverse={got.reverse} known={got.known}")

    total = len(cases) + len(choices) + len(orders)
    print(f"\n{total - failures}/{total} correct")
    return failures


if __name__ == "__main__":
    sys.exit(1 if self_check() else 0)
