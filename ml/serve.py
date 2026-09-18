"""Serves the local tile reader over HTTP, for the Spring app to call instead of Gemini.

The standard library rather than FastAPI, deliberately. There is one endpoint, it is bound to localhost
behind the JVM, and a read takes half a second — so there is nothing here that needs routing, dependency
injection or async. Skipping the framework keeps three more packages out of an image that has to share a
small droplet with a JVM, and out of the list of things to keep patched.

The reading itself comes from the recognition package beside this, which is where the whole pipeline
lives and is covered by tests/test_reader.py. This module is the only entry point into it.

Run it with `python serve.py`, or see the Dockerfile beside it.
"""

import base64
import binascii
import json
import os
import sys
import time
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from recognition.reader import Meld, Refusal, as_json, decode, load_model, read_hand, shrink
from recognition.tiles import BACK

# The upload path already caps a photo at 2048px on the long edge, which is about 1.5MB of JPEG and 2MB
# of base64. This leaves generous room above that and still refuses to buffer something absurd.
MAX_BODY = 12 * 1024 * 1024

# Chunk-size lines are a few hex digits; anything longer is not framing.
MAX_CHUNK_LINE = 32

# The refusals this layer adds to the reader's own — see the note on those in recognition/reader.py. A reading that
# broke a rule of the game rather than one that could not be produced.
UNDECODABLE = "undecodable"  # the bytes are not an image this can open
TOO_MANY_TILES = "too-many-tiles"  # more tiles than any hand holds, so something else was read as one
IMPOSSIBLE_TILES = "impossible-tiles"  # more than the four of a tile that were ever made
FACE_DOWN_IN_HAND = "face-down-in-hand"  # standing tiles read as face down, so this is not the hand
TOO_UNCERTAIN = "too-uncertain"  # half the row in doubt, which is the cut rather than the tiles

# How sure a cell has to be before it stops counting towards "half the row is in doubt". Its own number rather
# than the reader's CONFIDENT, which is the bar for flagging a single tile as worth a look, because the two
# move for different reasons: this one had to come down when the classifier learnt what a bare table looks
# like. It became honest about the cells that are background — saying so at 0.4 rather than calling them a tile
# back at 0.88 — and the gate then turned that honesty into two refusals. At 0.7 those two photos come back with
# 13 more correct tiles between them and nothing wrong; 0.7 down to 0.4 all measure the same, so it sits at the
# top of that range.
SURE_ENOUGH = 0.7

MODEL = None
LABELS: list[str] = []
SIZE = 0


class BadRequest(Exception):
    """A request this server will not read, with the status to answer and why."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def implausible(tiles: list[str], melds: list[Meld], sure: list[float]) -> Refusal | None:
    """Why this reading cannot be tiles at all, whatever confidence it came back with.

    Only what no set of tiles can be: four of any tile were ever made, and a standing row is never
    mostly face down. What that last one means is that the standing hand was not found — on the samples
    it fires on, the row it fires about is the only thing in the frame that fitted a grid at all. It does
    not say a wall is in the frame, and it used to: an almost drawn-out wall is two blocks rather than a
    long run, so face-down tiles being present says nothing about how many there are. A 暗杠 hides
    exactly two, so one or two here is that many misread tiles, which the caller drops and the user
    fills in. How many tiles there are is deliberately not checked: the calculators hold their result
    until fourteen are entered, so a short reading is tiles the user keeps, not something to throw away.
    """
    every = list(tiles) + [tile for meld in melds for tile in meld.tiles]
    # Eighteen is the ceiling: fourteen tiles, and one more for each of at most four 杠 that drew a
    # replacement — four 杠 plus the pair being the most a hand can hold. Reaching it here means the
    # standing row and something taken for a meld were both counted, which cannot both be right: a row of
    # thirteen or fourteen is a whole hand, and a hand with any meld standing has eleven at most.
    if len(every) > 18:
        return Refusal(TOO_MANY_TILES, f"read {len(every)} tiles, and no hand holds more than eighteen")
    backs = sum(1 for tile in tiles if tile == BACK)
    if backs > 2:
        return Refusal(FACE_DOWN_IN_HAND, f"read {backs} of the standing tiles as face down")
    repeats = max(Counter(tile for tile in every if tile != BACK).values(), default=0)
    if repeats > 4:
        return Refusal(IMPOSSIBLE_TILES, f"read the same tile {repeats} times")
    doubtful = sum(1 for chance in sure if chance < SURE_ENOUGH)
    if sure and doubtful * 2 >= len(sure):
        return Refusal(TOO_UNCERTAIN, f"unsure of {doubtful} of the {len(sure)} tiles")
    return None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # Without this the reads in _read_body block forever. HTTP/1.1 keeps connections open between
    # requests and ThreadingHTTPServer gives each connection a thread, so a peer that connects and then
    # stalls holds a thread until it disconnects — enough of them and the process is out of threads.
    # Twenty seconds is far above a real request: the JVM's own read timeout is ten.
    timeout = 20

    def log_request(self, code="-", size="-") -> None:
        # /healthz is polled every few seconds and drowned out everything else in this log.
        # A POST to /recognize logs its own received/outcome lines below; anything else (a GET to
        # that path, say) still gets this line, since nothing else would report it.
        if self.path == "/healthz" or (self.path == "/recognize" and self.command == "POST"):
            return
        print(f"reader: {self.command} {self.path} -> {code}", flush=True)

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

    def _reply(self, status: int, payload: dict, note: str) -> None:
        """Sends `payload` as `status`, and logs the same status so the two can never drift apart."""
        print(f"reader: [{status}] {note}", flush=True)
        self._send(status, payload)

    def do_POST(self) -> None:
        if self.path != "/recognize":
            self._send(404, {"message": "not found"})
            return

        try:
            body = self._read_body()
        except BadRequest as refusal:
            self._reply(refusal.status, {"message": refusal.message}, f"rejected — {refusal.message}")
            return

        try:
            request = json.loads(body)
            encoded = request["imageBase64"]
        except (json.JSONDecodeError, KeyError, TypeError, UnicodeDecodeError):
            self._reply(
                400,
                {"message": "expected a JSON body with an imageBase64 field"},
                "rejected — not a JSON body with imageBase64",
            )
            return
        # A round does not exist yet at recognition time, so this is the most this log can place a
        # request against — the session id, when the caller has one to give. Anything but a plain
        # int is discarded rather than logged: this value reaches a print() untouched, and a string
        # is how a log line gets forged.
        session_id = request.get("sessionId")
        valid_session = isinstance(session_id, int) and not isinstance(session_id, bool)
        tag = f" (session {session_id})" if valid_session else ""
        print(f"reader: received recognize request{tag}", flush=True)

        try:
            raw = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError, TypeError):
            # TypeError is a number or an object where the string should be: valid JSON, so it gets
            # past the parse above, and b64decode refuses it rather than the base64 check doing so.
            self._reply(
                400,
                {"message": "imageBase64 is not valid base64"},
                f"rejected{tag} — imageBase64 is not valid base64",
            )
            return

        bgr = decode(raw)
        if bgr is None:
            self._reply(
                415,
                {"code": UNDECODABLE, "message": "could not decode the image"},
                f"rejected{tag} — {UNDECODABLE}: could not decode the image",
            )
            return

        started = time.perf_counter()
        # The original as well as the shrunk copy: the row is found on the small one and the tiles are
        # read off the large one. See the note in _read_hand_upright.
        reading = read_hand(MODEL, LABELS, SIZE, shrink(bgr), full=bgr)
        elapsed_ms = (time.perf_counter() - started) * 1000
        # A refused photo answers with the code as well as the sentence. The caller words the code for a
        # player reading Chinese; the sentence is for whoever is reading the log, and passing it straight
        # through to the browser is what used to happen.
        refusal = (
            reading
            if isinstance(reading, Refusal)
            else implausible(reading.tiles, reading.melds, reading.confidence)
        )
        if refusal is not None:
            self._reply(
                422,
                {"code": refusal.code, "message": refusal.why},
                f"declined{tag} — {refusal.code}: {refusal.why} ({elapsed_ms:.0f}ms)",
            )
            return
        if reading.confidence:
            min_index = min(range(len(reading.confidence)), key=reading.confidence.__getitem__)
            mean_conf = sum(reading.confidence) / len(reading.confidence)
            min_conf = f"{reading.confidence[min_index]:.2f} (tile #{min_index + 1})"
        else:
            mean_conf = 0.0
            min_conf = "n/a"
        self._reply(
            200,
            as_json(reading),
            f"recognized{tag} {len(reading.tiles)} tiles, mean_conf={mean_conf:.2f}, min_conf={min_conf}, "
            f"melds={len(reading.melds)}, winning={reading.winning} ({elapsed_ms:.0f}ms)",
        )


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


if __name__ == "__main__":
    main()
