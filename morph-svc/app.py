#!/usr/bin/env python3
"""morph-svc — tiny Oslo-Bergen Tagger wrapper.

word -> morphological analyses {lemma, pos, is_compound, head}. Pure morphology:
NO database, NO product logic. The backend's /resolve compound-miss path calls
this and maps the head/lemma to a lemma_uuid via its own WordForm lookup.

Stdlib only (http.server) so it runs on the old OBT base image with no pip deps.
"""

from __future__ import annotations

from functools import lru_cache
from concurrent.futures import Future
from concurrent.futures import TimeoutError as FutureTimeoutError
import json
import logging
import math
import multiprocessing
import os
import re
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer
from multiprocessing.connection import Connection
from multiprocessing.popen_forkserver import Popen
from typing import Optional

from mtag_entry import run_mtag

K_OBT_DIR = "/app/The-Oslo-Bergen-Tagger"
K_GRAMMAR = "cg/bm_morf.cg"
_CLEANUP_SECONDS = 0.5
_STARTUP_SECONDS = 15.0
_CONTEXT = multiprocessing.get_context("forkserver")
_CONTEXT.set_forkserver_preload(["mtag_worker"])

K_WORD_RE = re.compile(r"^[^\W\d_]+(?:-[^\W\d_]+)*$")
K_MAX_CONCURRENT_ANALYSES = int(os.environ.get("MORPH_MAX_CONCURRENT_ANALYSES", "8"))
K_SLOT_WAIT_SECONDS = float(os.environ.get("MORPH_SLOT_WAIT_SECONDS", "1.0"))
K_ANALYSIS_DEADLINE_SECONDS = float(
    os.environ.get("MORPH_ANALYSIS_DEADLINE_SECONDS", "3.0")
)
if (
    K_MAX_CONCURRENT_ANALYSES < 1
    or not math.isfinite(K_SLOT_WAIT_SECONDS)
    or K_SLOT_WAIT_SECONDS < 0
    or not math.isfinite(K_ANALYSIS_DEADLINE_SECONDS)
    or K_ANALYSIS_DEADLINE_SECONDS <= 0
):
    raise ValueError("invalid morph-svc admission limits")
_SEM = threading.BoundedSemaphore(K_MAX_CONCURRENT_ANALYSES)
_READY = threading.Event()
_STOPPING = threading.Event()
_FLIGHT_LOCK = threading.Lock()
_FLIGHTS: dict[str, Future] = {}
_LOG = logging.getLogger(__name__)


class _AllSlotsBusy(Exception):
    pass


class LockedPopen(Popen):
    def __init__(self, process) -> None:
        self._poll_lock = threading.Lock()
        super().__init__(process)

    def poll(self, flag: int = os.WNOHANG) -> Optional[int]:
        with self._poll_lock:
            return super().poll(flag)


def tag(word: str, deadline: float) -> bytes:
    reader, writer = _CONTEXT.Pipe(duplex=False)
    child = None
    receiver = None
    try:
        child = _CONTEXT.Process(target=run_mtag, args=(word, writer))
        setattr(child, "_Popen", LockedPopen)
        child.start()
        writer.close()
        if not reader.poll(_remaining(deadline)):
            raise subprocess.TimeoutExpired("mtag", K_ANALYSIS_DEADLINE_SECONDS)
        result: Future = Future()
        receiver = threading.Thread(target=_receive, args=(reader, result), daemon=True)
        receiver.start()
        try:
            tagged = result.result(timeout=_remaining(deadline))
        except FutureTimeoutError as error:
            raise subprocess.TimeoutExpired(
                "mtag", K_ANALYSIS_DEADLINE_SECONDS
            ) from error
        except EOFError as error:
            raise RuntimeError("mtag exited without output") from error
        child.join(timeout=_remaining(deadline))
        if child.is_alive():
            raise subprocess.TimeoutExpired("mtag", K_ANALYSIS_DEADLINE_SECONDS)
        if child.exitcode != 0:
            raise RuntimeError("mtag failed: rc={}".format(child.exitcode))
        return tagged
    finally:
        cleanup_deadline = time.monotonic() + _CLEANUP_SECONDS
        try:
            if child is not None and child.pid is not None:
                try:
                    os.kill(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                child.join(timeout=_CLEANUP_SECONDS)
        finally:
            reader.close()
            writer.close()
            if receiver is not None:
                receiver.join(timeout=max(0, cleanup_deadline - time.monotonic()))


def analyze(word: str, *, deadline: Optional[float] = None) -> list[dict]:
    if deadline is None:
        deadline = time.monotonic() + K_ANALYSIS_DEADLINE_SECONDS
    tagged = tag(word, deadline)
    cg = subprocess.run(
        ["vislcg3", "--grammar", K_GRAMMAR, "--no-pass-origin", "--show-end-tags"],
        input=tagged,
        cwd=K_OBT_DIR,
        capture_output=True,
        timeout=_remaining(deadline),
    )
    if cg.returncode != 0:
        raise RuntimeError("vislcg3 failed: rc={}".format(cg.returncode))
    _remaining(deadline)
    return _parse(cg.stdout.decode("utf-8", "replace"))


def is_ready() -> bool:
    return _READY.is_set()


def set_ready(ready: bool) -> None:
    if ready and not _STOPPING.is_set():
        _READY.set()
    else:
        _READY.clear()


def request_stop() -> None:
    _READY.clear()
    _STOPPING.set()


def clear_cache() -> None:
    _analyze_admitted.cache_clear()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    _STOPPING.clear()
    server = ThreadingHTTPServer(("0.0.0.0", 8001), Handler, bind_and_activate=False)
    server.request_queue_size = 128
    server.server_bind()
    server.server_activate()

    def stop(_signal, _frame) -> None:
        request_stop()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    serving = threading.Thread(
        target=server.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True
    )
    serving.start()
    try:
        probe = analyze("møter", deadline=time.monotonic() + _STARTUP_SECONDS)
        if not any(entry["lemma"] == "møte" for entry in probe):
            raise RuntimeError("startup probe did not produce møte")
        if not _STOPPING.is_set():
            set_ready(True)
        while not _STOPPING.wait(timeout=0.1):
            pass
    finally:
        request_stop()
        server.shutdown()
        serving.join(timeout=1)
        deadline = (
            time.monotonic()
            + K_SLOT_WAIT_SECONDS
            + K_ANALYSIS_DEADLINE_SECONDS
            + _CLEANUP_SECONDS
        )
        with _FLIGHT_LOCK:
            pending = list(_FLIGHTS.values())
        for future in pending:
            try:
                future.result(timeout=max(0, deadline - time.monotonic()))
            except Exception:
                pass
        server.server_close()


class Handler(BaseHTTPRequestHandler):
    def setup(self) -> None:
        self.request.settimeout(
            K_SLOT_WAIT_SECONDS + K_ANALYSIS_DEADLINE_SECONDS + _CLEANUP_SECONDS
        )
        super().setup()

    def do_GET(self) -> None:
        if self.path == "/health":
            if is_ready():
                self._send(200, {"status": "ok"})
            else:
                self._send(503, {"status": "not ready"})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/analyze":
            self._send(404, {"error": "not found"})
            return
        if not is_ready():
            self._send(503, {"error": "busy"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
        except (ValueError, TypeError):
            length = 0
        if length <= 0 or length > 4096:
            self._send(413, {"error": "payload too large"})
            return
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
            word = str(payload.get("word", "")).strip()
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "invalid json"})
            return
        if not K_WORD_RE.match(word) or len(word) > 64:
            self._send(400, {"error": "word must be a single Norwegian token"})
            return

        try:
            analyses = _analyze_cached(word)
        except _AllSlotsBusy:
            self._send(503, {"error": "busy"})
        except subprocess.TimeoutExpired:
            self._send(504, {"error": "analysis timeout"})
        except Exception:
            _LOG.exception("analysis failed for %r", word)
            self._send(500, {"error": "analysis failed"})
        else:
            self._send(200, {"word": word, "analyses": analyses})

    def log_message(self, *_args) -> None:
        pass

    def _send(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _remaining(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise subprocess.TimeoutExpired("analysis", K_ANALYSIS_DEADLINE_SECONDS)
    return remaining


def _receive(reader: Connection, result: Future) -> None:
    try:
        result.set_result(reader.recv_bytes())
    except Exception as error:
        result.set_exception(error)


def _parse(out: str) -> list[dict]:
    """OBT CG output -> [{lemma, pos, is_compound, head}]. Returns all analyses."""
    analyses: list[dict] = []
    seen = set()
    in_word = False
    for line in out.splitlines():
        if re.match(r"<word>.*</word>", line):
            in_word = True
            continue
        if in_word and line.startswith("\t"):
            m = re.match(r'\t"([^"]+)"\s+(.*)', line)
            if not m:
                continue
            lemma, tags = m.group(1), m.group(2)
            parts = tags.split()
            pos = parts[0] if parts else ""
            if pos == "clb" or lemma.startswith("$"):
                continue
            head_match = re.search(r"<\+([^>]+)>", tags)
            entry = {
                "lemma": lemma,
                "pos": pos,
                "is_compound": "samset" in tags,
                "head": head_match.group(1) if head_match else None,
            }
            key = (entry["lemma"], entry["pos"], entry["head"], entry["is_compound"])
            if key in seen:
                continue
            seen.add(key)
            analyses.append(entry)
    return analyses


@lru_cache(maxsize=1024)
def _analyze_admitted(word: str) -> list[dict]:
    if not _SEM.acquire(timeout=K_SLOT_WAIT_SECONDS):
        raise _AllSlotsBusy
    try:
        if _STOPPING.is_set():
            raise _AllSlotsBusy
        _LOG.info("analysis started word=%r", word)
        return analyze(word)
    finally:
        _SEM.release()


def _analyze_cached(word: str) -> list[dict]:
    with _FLIGHT_LOCK:
        future = _FLIGHTS.get(word)
        owner = future is None
        if future is None:
            future = Future()
            _FLIGHTS[word] = future
    if not owner:
        try:
            return future.result(
                timeout=K_SLOT_WAIT_SECONDS
                + K_ANALYSIS_DEADLINE_SECONDS
                + _CLEANUP_SECONDS
            )
        except FutureTimeoutError as error:
            raise subprocess.TimeoutExpired("analysis", 0) from error
    try:
        result = _analyze_admitted(word)
    except BaseException as error:
        with _FLIGHT_LOCK:
            del _FLIGHTS[word]
            future.set_exception(error)
        raise
    else:
        with _FLIGHT_LOCK:
            del _FLIGHTS[word]
            future.set_result(result)
        return result


if __name__ == "__main__":
    main()
