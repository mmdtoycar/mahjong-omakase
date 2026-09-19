"""Checks the HTTP layer by driving the handler with a fake socket instead of a real one.

Partly because this sandbox refuses to bind a port, so there was no way to smoke-test the HTTP layer at all;
and partly because the interesting cases are the refusals, which are tedious to provoke with curl and cheap
to assert here.

Run it with `python -m tests.test_serve` from `ml`, or every check at once with `python -m tests.check`.
This is the one the Dockerfile runs as a build gate.
"""

import base64
import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import serve
from recognition.reader import BACK, Meld, load_model
from serve import (
    FACE_DOWN_IN_HAND,
    IMPOSSIBLE_TILES,
    MAX_BODY,
    TOO_MANY_TILES,
    TOO_UNCERTAIN,
    Handler,
    implausible,
)


def self_check() -> int:
    # Loaded into the serve module rather than into this one: the handler reads them from there, and a
    # `global` here would only bind names nothing looks at.
    serve.MODEL, serve.LABELS, serve.SIZE = load_model()

    blank = cv2.imencode(".jpg", np.full((400, 600, 3), (50, 56, 30), np.uint8))[1]
    # A hand photo is not in the repository — it is one table's tiles and 200KB of binary — so the two
    # cases that need one are skipped when it is absent rather than failing the run.
    hand_file = Path(__file__).resolve().parent / "test_hand.jpg"
    photo = cv2.imencode(".jpg", cv2.imread(str(hand_file)))[1] if hand_file.exists() else None

    def drive(raw: bytes):
        """Push one raw request through the handler over a fake socket."""

        class Driver(Handler):
            def __init__(self):
                self.rfile, self.wfile = io.BytesIO(raw), io.BytesIO()
                self.client_address = ("127.0.0.1", 0)
                self.requestline, self.request_version, self.command = "", "", ""
                self.handle_one_request()

            def setup(self):
                pass

            def finish(self):
                pass

            def log_request(self, code="-", size="-"):
                pass

        written = Driver().wfile.getvalue()
        payload = written.split(b"\r\n\r\n", 1)[1]
        return int(written.split(b" ", 2)[1]), json.loads(payload) if payload else {}

    def request(
        method: str,
        path: str,
        body: bytes | None = None,
        length: int | None = None,
        chunked: bool = False,
    ):
        head = f"{method} {path} HTTP/1.1\r\nHost: localhost\r\n"
        if chunked:
            head += "Transfer-Encoding: chunked\r\n"
            framed = b""
            for start in range(0, len(body or b""), 4089):  # 0xff9, the size that exposed this
                piece = body[start : start + 4089]
                framed += f"{len(piece):x}\r\n".encode() + piece + b"\r\n"
            body = framed + b"0\r\n\r\n"
        elif body is not None:
            head += f"Content-Length: {length if length is not None else len(body)}\r\n"
        return drive(head.encode() + b"\r\n" + (body or b""))

    def encoded(buffer) -> bytes:
        return json.dumps({"imageBase64": base64.b64encode(buffer.tobytes()).decode()}).encode()

    def request_raw_chunked_garbage():
        """A chunked body whose first chunk header is not a hex number."""
        return drive(
            b"POST /recognize HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\nnope\r\n"
        )

    cases = [
        ("healthz", lambda: request("GET", "/healthz"), 200),
        ("unknown path", lambda: request("GET", "/nope"), 404),
        ("POST to the wrong path", lambda: request("POST", "/nope", b"{}"), 404),
        ("empty body", lambda: request("POST", "/recognize", b"", 0), 400),
        ("not JSON", lambda: request("POST", "/recognize", b"not json"), 400),
        ("no imageBase64", lambda: request("POST", "/recognize", b'{"mimeType":"image/jpeg"}'), 400),
        (
            "imageBase64 is not base64",
            lambda: request("POST", "/recognize", b'{"imageBase64":"!!!!"}'),
            400,
        ),
        (
            "imageBase64 is not a string",
            lambda: request("POST", "/recognize", b'{"imageBase64":123}'),
            400,
        ),
        (
            "base64 of something that is not an image",
            lambda: request(
                "POST", "/recognize", json.dumps({"imageBase64": base64.b64encode(b"nope").decode()}).encode()
            ),
            415,
        ),
        ("over the size limit", lambda: request("POST", "/recognize", b"{}", MAX_BODY + 1), 413),
        ("a photo with no hand in it", lambda: request("POST", "/recognize", encoded(blank)), 422),
    ]
    if photo is not None:
        cases.append(("the real hand photo", lambda: request("POST", "/recognize", encoded(photo)), 200))
        # The regression that mattered. Spring's RestClient does not know the length of a JSON body it
        # is serialising, so it sends Transfer-Encoding: chunked — which this server read as an empty
        # body and then tried to parse the first chunk-size line as the next request line, answering
        # `Bad request syntax ('ff9')`. Framed here at that same 0xff9 bytes per chunk.
        cases.append(
            (
                "the same photo, chunked (as Spring sends it)",
                lambda: request("POST", "/recognize", encoded(photo), chunked=True),
                200,
            )
        )
    else:
        print(f"  skip {hand_file.name} is not present; the success path is unchecked")
    cases.append(("chunked with a broken chunk header", request_raw_chunked_garbage, 400))
    # HEIC, which is what an iPhone actually produces and what reaches this server whenever the browser
    # could not decode it. Encoded here rather than checked in as a fixture, so the test exercises the
    # decoder rather than one particular phone's file.
    if photo is not None:
        heic = io.BytesIO()
        Image.open(io.BytesIO(photo.tobytes())).save(heic, format="HEIF", quality=80)
        heic_body = json.dumps(
            {"imageBase64": base64.b64encode(heic.getvalue()).decode(), "mimeType": "image/heic"}
        ).encode()
        cases.append(("the same photo as HEIC", lambda: request("POST", "/recognize", heic_body), 200))

    # What `implausible` turns away, checked as tiles rather than through a photograph — the same
    # reason judge_meld is checked that way in tests/test_reader.py: a fixture built out of images fails for
    # reasons that belong to the image, and the temptation is then to loosen the rule until it passes.
    hand = ["1m"] * 4 + ["2m"] * 4 + ["3m"] * 4 + ["4m", "5m"]
    certain = [0.95] * len(hand)
    rules = [
        ("a legal fourteen", hand, [], certain, None),
        ("thirteen, which the user fills in", hand[:13], [], certain[:13], None),
        ("one misread back, dropped downstream", [BACK] + hand[1:], [], certain, None),
        ("a row that is mostly face down", [BACK] * 8 + hand[8:], [], certain, FACE_DOWN_IN_HAND),
        ("a fifth copy of a tile", ["1m"] * 5 + hand[4:13], [], certain, IMPOSSIBLE_TILES),
        (
            "a whole row plus something taken for melds",
            hand,
            [Meld("ke", ["9p"] * 3, True), Meld("ke", ["8s"] * 3, True)],
            certain,
            TOO_MANY_TILES,
        ),
        ("a few tiles in doubt is still a hand", hand, [], [0.95] * 9 + [0.4] * 5, None),
        ("half the row in doubt is a bad cut", hand, [], [0.95] * 7 + [0.4] * 7, TOO_UNCERTAIN),
    ]

    failures = 0
    for name, call, want in cases:
        status, payload = call()
        ok = status == want
        failures += not ok
        detail = payload.get("message") or f"{len(payload.get('concealed', []))} tiles"
        print(f"  {'ok  ' if ok else 'FAIL'} {name:38s} {status} (want {want})  {detail}")

    for name, tiles, melds, sure, want in rules:
        got = implausible(tiles, melds, sure)
        ok = got is None if want is None else (got is not None and got.code == want)
        failures += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name:38s} {got.code if got else 'read as a hand'}")

    # The successful read has to come back in the shape the UI parses.
    if photo is not None:
        _, hand = request("POST", "/recognize", encoded(photo))
        for field in ("concealed", "melds", "winningTile", "isSelfDraw", "notes"):
            if field not in hand:
                print(f"  FAIL response is missing {field}")
                failures += 1
    total = len(cases) + len(rules)
    print(f"\n{total - failures}/{total} correct")
    return failures


if __name__ == "__main__":
    sys.exit(1 if self_check() else 0)
