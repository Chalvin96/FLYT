#!/usr/bin/env python3
"""morph-svc — tiny Oslo-Bergen Tagger wrapper.

word -> morphological analyses {lemma, pos, is_compound, head}. Pure morphology:
NO database, NO product logic. The backend's /resolve compound-miss path calls
this and maps the head/lemma to a lemma_uuid via its own WordForm lookup.

Stdlib only (http.server) so it runs on the old OBT base image with no pip deps.
"""

from __future__ import annotations

from functools import lru_cache
import json
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer

OBT_DIR = "/app/The-Oslo-Bergen-Tagger"
GRAMMAR = "cg/bm_morf.cg"  # text CG (~28ms/call; negligible vs mtag's lexicon load)
WORD_RE = re.compile(r"^[A-Za-zÆØÅæøå]+(?:-[A-Za-zÆØÅæøå]+)*$")
TIMEOUT_S = 10
_MAX_CONCURRENT_ANALYSES = 4
_SEM = threading.BoundedSemaphore(_MAX_CONCURRENT_ANALYSES)


class _AllSlotsBusy(Exception):
    pass


def analyze(word: str) -> list[dict]:
    """Run `mtag | vislcg3 (text CG grammar)` on a single word, parse the output."""
    tagged = subprocess.run(
        ["python3", "mtag/mtag.py", "-wxml", "-l", "/tmp/mtag.log"],
        input=(word + "\n").encode("utf-8"),
        cwd=OBT_DIR,
        capture_output=True,
        timeout=TIMEOUT_S,
    )
    if tagged.returncode != 0:
        raise RuntimeError(f"mtag failed: rc={tagged.returncode}")
    cg = subprocess.run(
        ["vislcg3", "--grammar", GRAMMAR, "--no-pass-origin", "--show-end-tags"],
        input=tagged.stdout,
        cwd=OBT_DIR,
        capture_output=True,
        timeout=TIMEOUT_S,
    )
    if cg.returncode != 0:
        raise RuntimeError(f"vislcg3 failed: rc={cg.returncode}")
    return _parse(cg.stdout.decode("utf-8", "replace"))


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
            # skip OBT's appended punctuation/clause-boundary token (e.g. "$." clb)
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
            if key in seen:  # OBT can repeat an identical analysis
                continue
            seen.add(key)
            analyses.append(entry)
    return analyses


@lru_cache(maxsize=1024)
def _analyze_cached(word: str) -> list[dict]:
    """Cache on the exact word as requested; failures raise and stay uncached."""
    if not _SEM.acquire(blocking=False):
        raise _AllSlotsBusy
    try:
        return analyze(word)
    finally:
        _SEM.release()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send(200, {"status": "ok"})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/analyze":
            self._send(404, {"error": "not found"})
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
        if not WORD_RE.match(word) or len(word) > 64:
            self._send(400, {"error": "word must be a single Norwegian token"})
            return

        try:
            analyses = _analyze_cached(word)
        except _AllSlotsBusy:
            self._send(503, {"error": "busy"})
        except subprocess.TimeoutExpired:
            self._send(504, {"error": "analysis timeout"})
        except Exception:
            self._send(500, {"error": "analysis failed"})
        else:
            self._send(200, {"word": word, "analyses": analyses})

    def log_message(self, *_args) -> None:  # keep logs quiet
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8001), Handler).serve_forever()
