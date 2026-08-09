"""Serves the local tile reader over HTTP, for the Spring app to call instead of Gemini.

The standard library rather than FastAPI, deliberately. There is one endpoint, it is bound to localhost
behind the JVM, and a read takes half a second — so there is nothing here that needs routing, dependency
injection or async. Skipping the framework keeps three more packages out of an image that has to share a
small droplet with a JVM, and out of the list of things to keep patched.

The reader itself comes from try_real_photo, which is the module the whole pipeline grew up in and is
covered by its self-checks; a production service importing something called `try_real_photo` reads
oddly, and renaming it is a tidy-up worth doing separately from this.

Run it with `python serve.py`, or see the Dockerfile beside it.
"""

import base64
import binascii
import io
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from try_real_photo import as_json, decode, load_model, read_hand, shrink

# The upload path already caps a photo at 2048px on the long edge, which is about 1.5MB of JPEG and 2MB
# of base64. This leaves generous room above that and still refuses to buffer something absurd.
MAX_BODY = 12 * 1024 * 1024

# Chunk-size lines are a few hex digits; anything longer is not framing.
MAX_CHUNK_LINE = 32

MODEL = None
LABELS: list[str] = []
SIZE = 0


class BadRequest(Exception):
    """A request this server will not read, with the status to answer and why."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # Without this the reads in _read_body block forever. HTTP/1.1 keeps connections open between
    # requests and ThreadingHTTPServer gives each connection a thread, so a peer that connects and then
    # stalls holds a thread until it disconnects — enough of them and the process is out of threads.
    # Twenty seconds is far above a real request: the JVM's own read timeout is ten.
    timeout = 20

    def log_message(self, fmt: str, *args) -> None:
        # The default writes to stderr in Apache format; one line per request in the same shape as the
        # rest of the container's output is easier to read alongside the JVM's.
        print(f"reader: {self.address_string()} {fmt % args}", flush=True)

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        # Something for the container healthcheck and for the JVM to probe at startup, so a
        # misconfigured sidecar shows up as unhealthy rather than as a failed recognition later.
        if self.path == "/healthz":
            self._send(200, {"status": "ok", "labels": len(LABELS)})
        else:
            self._send(404, {"message": "not found"})

    def _read_body(self) -> bytes:
        """The request body, however the client chose to frame it, bounded either way.

        Chunked has to be handled, not just Content-Length. Spring's RestClient serialises a JSON body
        straight to the socket, so it does not know the length in advance and sends
        `Transfer-Encoding: chunked` — which this read as a zero-length body and then tried to parse
        the first chunk-size line as the next request, answering `Bad request syntax ('ff9')`. That
        `ff9` was 4089 bytes of photo in hex.

        The size limit is enforced as the chunks arrive, because with chunked framing there is nothing
        to check up front.
        """
        if "chunked" in self.headers.get("Transfer-Encoding", "").lower():
            chunks, total = [], 0
            while True:
                line = self.rfile.readline(MAX_CHUNK_LINE)
                try:
                    # A chunk header may carry extensions after a semicolon; the size is the first field.
                    size = int(line.split(b";")[0].strip(), 16)
                except ValueError:
                    raise BadRequest(400, "malformed chunked body") from None
                if size == 0:
                    self.rfile.readline()  # the empty line closing the last chunk
                    break
                total += size
                if total > MAX_BODY:
                    raise BadRequest(413, f"body is over the {MAX_BODY} byte limit")
                chunks.append(self.rfile.read(size))
                self.rfile.readline()  # the CRLF after each chunk
            return b"".join(chunks)

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise BadRequest(400, "Content-Length is not a number") from None
        if length <= 0:
            raise BadRequest(400, "empty request body")
        if length > MAX_BODY:
            raise BadRequest(413, f"body of {length} bytes is over the {MAX_BODY} limit")
        return self.rfile.read(length)

    def do_POST(self) -> None:
        if self.path != "/recognize":
            self._send(404, {"message": "not found"})
            return
        try:
            body = self._read_body()
        except BadRequest as refusal:
            self._send(refusal.status, {"message": refusal.message})
            return

        try:
            request = json.loads(body)
            encoded = request["imageBase64"]
        except (json.JSONDecodeError, KeyError, TypeError, UnicodeDecodeError):
            self._send(400, {"message": "expected a JSON body with an imageBase64 field"})
            return

        try:
            raw = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError, TypeError):
            # TypeError is a number or an object where the string should be: valid JSON, so it gets
            # past the parse above, and b64decode refuses it rather than the base64 check doing so.
            self._send(400, {"message": "imageBase64 is not valid base64"})
            return

        bgr = decode(raw)
        if bgr is None:
            self._send(415, {"message": "could not decode the image"})
            return

        reading = read_hand(MODEL, LABELS, SIZE, shrink(bgr))
        if isinstance(reading, str):
            # Nothing in the photo looked like a hand. A 422 rather than a 500: the request was fine,
            # the picture was not, and the caller should offer the online path instead.
            self._send(422, {"message": reading})
            return
        self._send(200, as_json(reading))


def main() -> None:
    global MODEL, LABELS, SIZE
    MODEL, LABELS, SIZE = load_model()
    port = int(os.environ.get("READER_PORT", "8000"))
    # Localhost only. Nothing here authenticates, and it is not meant to be reachable from outside the
    # host — the JVM in front of it is what checks the session token.
    host = os.environ.get("READER_HOST", "127.0.0.1")
    print(f"reader: {len(LABELS)} labels, listening on {host}:{port}", flush=True)
    try:
        ThreadingHTTPServer((host, port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("reader: stopping", flush=True)
        sys.exit(0)


# ── self-check ─────────────────────────────────────────────────────────────
#
# Drives the handler with a fake socket instead of a real one. Partly because this sandbox refuses to
# bind a port, so there was no way to smoke-test the HTTP layer here at all; and partly because the
# interesting cases are the refusals, which are tedious to provoke with curl and cheap to assert here.


def self_check() -> int:
    global MODEL, LABELS, SIZE
    MODEL, LABELS, SIZE = load_model()

    blank = cv2.imencode(".jpg", np.full((400, 600, 3), (50, 56, 30), np.uint8))[1]
    # A hand photo is not in the repository — it is one table's tiles and 200KB of binary — so the two
    # cases that need one are skipped when it is absent rather than failing the run.
    hand_file = Path(__file__).resolve().parent / "data/test_hand.jpg"
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

            def log_message(self, fmt, *args):
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

    failures = 0
    for name, call, want in cases:
        status, payload = call()
        ok = status == want
        failures += not ok
        detail = payload.get("message") or f"{len(payload.get('concealed', []))} tiles"
        print(f"  {'ok  ' if ok else 'FAIL'} {name:38s} {status} (want {want})  {detail}")

    # The successful read has to come back in the shape the UI parses.
    if photo is not None:
        _, hand = request("POST", "/recognize", encoded(photo))
        for field in ("concealed", "melds", "winningTile", "isSelfDraw", "notes"):
            if field not in hand:
                print(f"  FAIL response is missing {field}")
                failures += 1
    print(f"\n{len(cases) - failures}/{len(cases)} correct")
    return failures


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        sys.exit(1 if self_check() else 0)
    main()
