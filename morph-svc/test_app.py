#!/usr/bin/env python3
"""HTTP-level tests for morph-svc: caching, capacity, and response shape.

Stdlib-only; `analyze` is mocked so the OBT subprocess pipeline is never run.
Run with:

    python -m pytest test_app.py -q
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
import json
import subprocess
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from typing import Any
from unittest import mock

import app as morph_svc


def _obt_analysis(
    lemma: str, pos: str = "subst", is_compound: bool = False, head: str | None = None
) -> dict[str, Any]:
    return {"lemma": lemma, "pos": pos, "is_compound": is_compound, "head": head}


class _Server:
    """A real ThreadingHTTPServer on a random port."""

    def __init__(self) -> None:
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), morph_svc.Handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def post(self, word: str) -> tuple[int, dict[str, Any]]:
        data = json.dumps({"word": word}).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/analyze",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read())


@contextmanager
def _live_server() -> Iterator[_Server]:
    morph_svc._analyze_cached.cache_clear()
    server = _Server()
    try:
        yield server
    finally:
        server.httpd.shutdown()
        server.httpd.server_close()
        server.thread.join(timeout=5)


@contextmanager
def _all_slots_held() -> Iterator[None]:
    for _ in range(morph_svc._MAX_CONCURRENT_ANALYSES):
        assert morph_svc._SEM.acquire(blocking=False)
    try:
        yield
    finally:
        for _ in range(morph_svc._MAX_CONCURRENT_ANALYSES):
            morph_svc._SEM.release()


def test_analyze_given_repeated_word_expect_single_subprocess_call() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        analyze.return_value = [_obt_analysis("katt", "subst")]

        first = server.post("Katt")
        second = server.post("Katt")

        assert analyze.call_count == 1
        assert first[0] == second[0] == 200
        assert first[1]["word"] == second[1]["word"] == "Katt"
        assert first[1]["analyses"] == second[1]["analyses"]


def test_analyze_given_distinct_casings_expect_subprocess_per_casing() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        analyze.side_effect = [
            [_obt_analysis("Oslo", "prop")],
            [_obt_analysis("oslo", "subst")],
        ]

        proper = server.post("Oslo")
        common = server.post("oslo")

        assert analyze.call_count == 2
        assert [call.args[0] for call in analyze.call_args_list] == ["Oslo", "oslo"]
        assert proper[1]["analyses"][0]["pos"] == "prop"
        assert common[1]["analyses"][0]["pos"] == "subst"


def test_analyze_given_failed_or_timed_out_analysis_expect_retryable() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        analyze.side_effect = RuntimeError("obt crashed")
        assert server.post("feil")[0] == 500

        analyze.side_effect = subprocess.TimeoutExpired(["mtag"], 10)
        assert server.post("treg")[0] == 504

        analyze.side_effect = None
        analyze.return_value = [_obt_analysis("feil", "subst")]
        status, body = server.post("feil")
        assert status == 200
        assert analyze.call_count == 3
        assert body["analyses"][0]["lemma"] == "feil"


def test_analyze_given_exhausted_capacity_expect_503_without_subprocess() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        with _all_slots_held():
            status, body = server.post("opptatt")
            assert status == 503
            assert body == {"error": "busy"}
            analyze.assert_not_called()


def test_analyze_given_cached_word_expect_no_capacity_slot_consumed() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        analyze.return_value = [_obt_analysis("katt", "subst")]
        assert server.post("katt")[0] == 200

        with _all_slots_held():
            status, _body = server.post("katt")
            assert status == 200
            assert analyze.call_count == 1


def test_analyze_given_compound_word_expect_response_shape_with_head() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        analyze.return_value = [
            _obt_analysis("innbyggerantall", "subst", is_compound=True, head="antall")
        ]

        status, body = server.post("innbyggerantall")

        assert status == 200
        assert body["word"] == "innbyggerantall"
        assert body["analyses"] == [
            {
                "lemma": "innbyggerantall",
                "pos": "subst",
                "is_compound": True,
                "head": "antall",
            }
        ]
