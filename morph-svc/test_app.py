#!/usr/bin/env python3
"""HTTP behavior and real forkserver-child cleanup without the OBT dictionaries.
Run with:

    python -m pytest test_app.py -q
"""

from __future__ import annotations

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from http.server import ThreadingHTTPServer
import json
import multiprocessing
from multiprocessing import forkserver
import os
from pathlib import Path
import signal
import struct
import subprocess
import threading
import time
import urllib.error
import urllib.request
from typing import Any
from unittest import mock

import app as morph_svc
import pytest


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

    def get_health(self) -> int:
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{self.port}/health", timeout=2
            ) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code


def crash_child(_word: str, _connection: Any) -> None:
    os.kill(os.getpid(), signal.SIGKILL)


def hang_child(_word: str, _connection: Any) -> None:
    threading.Event().wait(timeout=30)


def partial_child(_word: str, connection: Any) -> None:
    os.write(connection.fileno(), struct.pack("!i", 128))
    threading.Event().wait(timeout=30)


def send_then_hang_child(_word: str, connection: Any) -> None:
    connection.send_bytes(b"tagged")
    threading.Event().wait(timeout=30)


def send_then_crash_child(_word: str, connection: Any) -> None:
    connection.send_bytes(b"tagged")
    os.kill(os.getpid(), signal.SIGKILL)


def send_child(_word: str, connection: Any) -> None:
    connection.send_bytes(b"tagged")
    connection.close()


@pytest.mark.parametrize(
    "word", ["kafé", "komitéen", "blandfôr", "Zürich", "kafé-bar", "møter"]
)
def test_word_re_given_accented_letters_expect_accepted(word: str) -> None:
    assert morph_svc.K_WORD_RE.match(word)


@pytest.mark.parametrize("word", ["", "kafe1", "to ord", "kafe_", "-kafe", "kafe-"])
def test_word_re_given_digits_spaces_or_stray_hyphens_expect_rejected(
    word: str,
) -> None:
    assert not morph_svc.K_WORD_RE.match(word)


@pytest.mark.parametrize(
    "target,error",
    [
        (crash_child, RuntimeError),
        (hang_child, subprocess.TimeoutExpired),
        (partial_child, subprocess.TimeoutExpired),
        (send_then_hang_child, subprocess.TimeoutExpired),
        (send_then_crash_child, RuntimeError),
    ],
)
def test_analyze_given_child_crash_or_timeout_expect_closed_pipes_and_reaped_child(
    target: Any, error: Any
) -> None:
    context = multiprocessing.get_context("forkserver")
    context.set_forkserver_preload([])
    processes = []
    pipes: list[Any] = []
    real_process = context.Process
    real_pipe = context.Pipe

    def create_process(**kwargs: Any) -> Any:
        process = real_process(**kwargs)
        processes.append(process)
        return process

    def create_pipe(**kwargs: Any) -> Any:
        connections = real_pipe(**kwargs)
        pipes.extend(connections)
        return connections

    with (
        mock.patch.object(morph_svc, "run_mtag", target),
        mock.patch.object(context, "Process", side_effect=create_process),
        mock.patch.object(context, "Pipe", side_effect=create_pipe),
        mock.patch.object(morph_svc, "_CONTEXT", context),
        mock.patch.object(morph_svc, "K_ANALYSIS_DEADLINE_SECONDS", 0.8),
    ):
        started = time.monotonic()
        with pytest.raises(error):
            morph_svc.analyze("katt")
        assert time.monotonic() - started < 2
    assert len(processes) == 1
    assert processes[0].exitcode is not None
    assert not processes[0].is_alive()
    assert all(connection.closed for connection in pipes)


def test_tag_given_forkserver_dies_expect_hanging_worker_pid_gone() -> None:
    context = multiprocessing.get_context("forkserver")
    context.set_forkserver_preload([])
    processes = []
    real_process = context.Process
    worker_pid = None

    def create_process(**kwargs: Any) -> Any:
        process = real_process(**kwargs)
        processes.append(process)
        return process

    try:
        with (
            mock.patch.object(morph_svc, "run_mtag", hang_child),
            mock.patch.object(context, "Process", side_effect=create_process),
            mock.patch.object(morph_svc, "_CONTEXT", context),
            ThreadPoolExecutor(max_workers=1) as pool,
        ):
            deadline = time.monotonic() + 2
            response = pool.submit(morph_svc.tag, "katt", deadline)
            while not processes or processes[0].pid is None:
                assert time.monotonic() < deadline
                time.sleep(0.01)
            worker_pid = processes[0].pid
            worker_stat = Path("/proc/{}/stat".format(worker_pid))
            status = worker_stat.read_text().rsplit(")", 1)[1].split()
            forkserver_pid = int(status[1])
            os.kill(forkserver_pid, signal.SIGKILL)

            with pytest.raises(subprocess.TimeoutExpired):
                response.result(timeout=3)
            cleanup_deadline = time.monotonic() + 1
            while worker_stat.exists() and time.monotonic() < cleanup_deadline:
                time.sleep(0.01)
            assert not worker_stat.exists()
    finally:
        if worker_pid is not None:
            try:
                os.kill(worker_pid, signal.SIGKILL)
            except ProcessLookupError:
                pass


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


def test_analyze_given_exhausted_capacity_expect_bounded_wait_then_503() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        with _all_slots_held():
            started = time.monotonic()
            assert server.post("opptatt") == (503, {"error": "busy"})
            elapsed = time.monotonic() - started
        assert 0.9 <= elapsed < 1.5
        analyze.assert_not_called()


def test_analyze_given_slot_released_during_wait_expect_success() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        analyze.return_value = [_obt_analysis("katt")]
        with ThreadPoolExecutor(max_workers=1) as pool:
            with _all_slots_held():
                response = pool.submit(server.post, "katt")
                with pytest.raises(TimeoutError):
                    response.result(timeout=0.05)
            assert response.result(timeout=2)[0] == 200
        assert analyze.call_count == 1


def test_analyze_given_concurrent_identical_misses_expect_one_analysis() -> None:
    started = threading.Event()
    release = threading.Event()

    def analyze_word(word: str) -> list[dict]:
        started.set()
        assert release.wait(timeout=3)
        return [_obt_analysis(word)]

    with (
        _live_server() as server,
        mock.patch.object(morph_svc, "analyze", side_effect=analyze_word) as analyze,
    ):
        with ThreadPoolExecutor(max_workers=20) as pool:
            responses = [pool.submit(server.post, "katt") for _ in range(20)]
            assert started.wait(timeout=2)
            time.sleep(0.2)
            release.set()
            results = [response.result(timeout=4) for response in responses]
        assert all(
            result == (200, {"word": "katt", "analyses": [_obt_analysis("katt")]})
            for result in results
        )
        assert analyze.call_count == 1


def test_analyze_given_failed_shared_flight_expect_same_failure_and_fresh_retry() -> (
    None
):
    started = threading.Event()

    def fail_after_cleanup(_word: str) -> list[dict]:
        started.set()
        threading.Event().wait(timeout=0.4)
        raise RuntimeError("child failed and was reaped")

    with (
        mock.patch.object(morph_svc, "K_SLOT_WAIT_SECONDS", 0),
        mock.patch.object(morph_svc, "K_ANALYSIS_DEADLINE_SECONDS", 0.05),
        _live_server() as server,
        mock.patch.object(
            morph_svc, "analyze", side_effect=fail_after_cleanup
        ) as analyze,
    ):
        with ThreadPoolExecutor(max_workers=2) as pool:
            owner = pool.submit(server.post, "feil")
            assert started.wait(timeout=1)
            follower = pool.submit(server.post, "feil")
            assert (
                owner.result(timeout=2)
                == follower.result(timeout=2)
                == (
                    500,
                    {"error": "analysis failed"},
                )
            )
        assert analyze.call_count == 1
        analyze.side_effect = None
        analyze.return_value = [_obt_analysis("feil")]
        assert server.post("feil")[0] == 200
        assert analyze.call_count == 2


def test_health_given_readiness_changes_expect_503_until_ready() -> None:
    with _live_server() as server:
        morph_svc.set_ready(False)
        assert server.get_health() == 503
        morph_svc.set_ready(True)
        assert server.get_health() == 200


def test_main_given_pending_startup_probe_expect_health_and_analysis_503() -> None:
    probe_started = threading.Event()
    release_probe = threading.Event()
    servers = []

    def create_server(_address: Any, handler: Any, **kwargs: Any) -> Any:
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler, **kwargs)
        servers.append(server)
        return server

    def probe(_word: str, **_kwargs: Any) -> list[dict]:
        probe_started.set()
        assert release_probe.wait(timeout=3)
        return [_obt_analysis("møte")]

    with (
        mock.patch.object(morph_svc, "ThreadingHTTPServer", side_effect=create_server),
        mock.patch.object(morph_svc.signal, "signal"),
        mock.patch.object(morph_svc, "analyze", side_effect=probe),
    ):
        running = threading.Thread(target=morph_svc.main, daemon=True)
        running.start()
        try:
            assert probe_started.wait(timeout=2)
            url = "http://127.0.0.1:{}".format(servers[0].server_address[1])
            for path, data in (("/health", None), ("/analyze", b'{"word":"katt"}')):
                with pytest.raises(urllib.error.HTTPError) as failure:
                    urllib.request.urlopen(url + path, data=data, timeout=0.5)
                assert failure.value.code == 503
                failure.value.close()
            release_probe.set()
            deadline = time.monotonic() + 2
            while not morph_svc.is_ready():
                assert time.monotonic() < deadline
                time.sleep(0.01)
            with urllib.request.urlopen(url + "/health", timeout=1) as response:
                assert response.status == 200
        finally:
            release_probe.set()
            morph_svc.request_stop()
            running.join(timeout=3)
            assert not running.is_alive()


def test_main_given_sigterm_delivered_to_request_thread_expect_clean_exit() -> None:
    context = multiprocessing.get_context("spawn")
    reader, writer = context.Pipe(duplex=False)
    child = context.Process(target=_serve_until_thread_signal, args=(writer,))
    try:
        child.start()
        writer.close()
        assert reader.poll(timeout=3)
        port = reader.recv()
        time.sleep(0.05)
        with urllib.request.urlopen(
            "http://127.0.0.1:{}/stop".format(port), timeout=1
        ) as response:
            assert response.status == 200
        child.join(timeout=1)
        assert not child.is_alive()
        assert child.exitcode == 0
    finally:
        if child.is_alive():
            child.kill()
        child.join(timeout=2)
        reader.close()
        writer.close()


def test_main_given_sigterm_before_readiness_expect_exit_without_second_stop() -> None:
    context = multiprocessing.get_context("spawn")
    reader, writer = context.Pipe(duplex=False)
    child = context.Process(target=_serve_with_startup_signal, args=(writer,))
    try:
        child.start()
        writer.close()
        assert reader.poll(timeout=3)
        ready = reader.recv()
        child.join(timeout=1)
        assert not child.is_alive()
        assert child.exitcode == 0
        assert not ready
    finally:
        if child.is_alive():
            child.kill()
        child.join(timeout=2)
        reader.close()
        writer.close()


def test_analyze_given_timed_out_word_expect_later_call_retries() -> None:
    with _live_server() as server, mock.patch.object(morph_svc, "analyze") as analyze:
        analyze.side_effect = [
            subprocess.TimeoutExpired("mtag", 3),
            [_obt_analysis("treg")],
        ]
        assert server.post("treg")[0] == 504
        assert server.post("treg")[0] == 200
        assert analyze.call_count == 2


def test_tag_given_concurrent_start_and_join_expect_successful_child_exit() -> None:
    context = multiprocessing.get_context("forkserver")
    context.set_forkserver_preload([])
    processes = []
    real_process = context.Process
    read_signed = forkserver.read_signed
    first_read = threading.Event()
    second_read = threading.Event()
    status_consumed = threading.Event()
    read_lock = threading.Lock()

    def create_process(**kwargs: Any) -> Any:
        process = real_process(**kwargs)
        processes.append(process)
        return process

    def read_status(fd: int) -> int:
        if not processes or processes[0].pid is None or fd != processes[0].sentinel:
            return read_signed(fd)
        with read_lock:
            first = not first_read.is_set()
            if first:
                first_read.set()
            else:
                second_read.set()
        if first:
            second_read.wait(timeout=0.2)
            status = read_signed(fd)
            status_consumed.set()
            return status
        assert status_consumed.wait(timeout=1)
        return read_signed(fd)

    with (
        mock.patch.object(morph_svc, "run_mtag", send_child),
        mock.patch.object(context, "Process", side_effect=create_process),
        mock.patch.object(morph_svc, "_CONTEXT", context),
        mock.patch.object(forkserver, "read_signed", side_effect=read_status),
        ThreadPoolExecutor(max_workers=2) as pool,
    ):
        first = pool.submit(morph_svc.tag, "katt", time.monotonic() + 3)
        assert first_read.wait(timeout=2)
        second = pool.submit(morph_svc.tag, "hund", time.monotonic() + 3)
        assert first.result(timeout=4) == second.result(timeout=4) == b"tagged"
    assert [process.exitcode for process in processes] == [0, 0]


def test_analyze_given_child_creation_or_start_failure_expect_closed_pipes() -> None:
    for operation in ("Process", "start"):
        context = mock.Mock()
        reader, writer = mock.Mock(), mock.Mock()
        context.Pipe.return_value = (reader, writer)
        context.Process.return_value.pid = None
        failing = (
            context.Process
            if operation == "Process"
            else context.Process.return_value.start
        )
        failing.side_effect = RuntimeError("cannot create process")
        with mock.patch.object(morph_svc, "_CONTEXT", context):
            with pytest.raises(RuntimeError, match="cannot create process"):
                morph_svc.analyze("katt")
        reader.close.assert_called_once()
        writer.close.assert_called_once()


def test_analyze_given_vislcg3_timeout_expect_remaining_deadline_and_closed_pipes() -> (
    None
):
    context = multiprocessing.get_context("forkserver")
    context.set_forkserver_preload([])
    pipes: list[Any] = []
    real_pipe = context.Pipe

    def create_pipe(**kwargs: Any) -> Any:
        connections = real_pipe(**kwargs)
        pipes.extend(connections)
        return connections

    with (
        mock.patch.object(morph_svc, "run_mtag", send_child),
        mock.patch.object(context, "Pipe", side_effect=create_pipe),
        mock.patch.object(morph_svc, "_CONTEXT", context),
        mock.patch.object(morph_svc, "K_ANALYSIS_DEADLINE_SECONDS", 0.5),
        mock.patch.object(morph_svc.subprocess, "run") as cg,
    ):
        cg.side_effect = subprocess.TimeoutExpired("vislcg3", 0.5)
        with pytest.raises(subprocess.TimeoutExpired):
            morph_svc.analyze("katt")
        assert cg.call_args.kwargs["input"] == b"tagged"
        assert 0 < cg.call_args.kwargs["timeout"] < 0.5
    assert all(connection.closed for connection in pipes)


def _obt_analysis(
    lemma: str, pos: str = "subst", is_compound: bool = False, head: str | None = None
) -> dict[str, Any]:
    return {"lemma": lemma, "pos": pos, "is_compound": is_compound, "head": head}


@contextmanager
def _live_server() -> Iterator[_Server]:
    morph_svc.clear_cache()
    with mock.patch.object(morph_svc, "_STOPPING", threading.Event()):
        morph_svc.set_ready(True)
        server = _Server()
        try:
            yield server
        finally:
            morph_svc.set_ready(False)
            server.httpd.shutdown()
            server.httpd.server_close()
            server.thread.join(timeout=5)


@contextmanager
def _all_slots_held() -> Iterator[None]:
    # Saturating admission needs the service's own semaphore.
    # ume-ignore: UME-PY002
    slots = morph_svc._SEM
    for _ in range(morph_svc.K_MAX_CONCURRENT_ANALYSES):
        assert slots.acquire(blocking=False)
    try:
        yield
    finally:
        for _ in range(morph_svc.K_MAX_CONCURRENT_ANALYSES):
            slots.release()


def _serve_until_thread_signal(connection: Any) -> None:
    servers = []

    def create_server(_address: Any, handler: Any, **kwargs: Any) -> Any:
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler, **kwargs)
        servers.append(server)
        return server

    def probe(_word: str, **_kwargs: Any) -> list[dict]:
        connection.send(servers[0].server_address[1])
        return [_obt_analysis("møte")]

    def send_signal(handler: Any) -> None:
        signal.pthread_kill(threading.get_ident(), signal.SIGTERM)
        handler._send(200, {})

    with (
        mock.patch.object(morph_svc, "ThreadingHTTPServer", side_effect=create_server),
        mock.patch.object(morph_svc, "analyze", side_effect=probe),
        mock.patch.object(morph_svc.Handler, "do_GET", send_signal),
    ):
        morph_svc.main()


def _serve_with_startup_signal(connection: Any) -> None:
    set_ready = morph_svc.set_ready

    def create_server(_address: Any, handler: Any, **kwargs: Any) -> Any:
        return ThreadingHTTPServer(("127.0.0.1", 0), handler, **kwargs)

    def publish_readiness(ready: bool) -> None:
        os.kill(os.getpid(), signal.SIGTERM)
        set_ready(ready)
        connection.send(morph_svc.is_ready())

    with (
        mock.patch.object(morph_svc, "ThreadingHTTPServer", side_effect=create_server),
        mock.patch.object(morph_svc, "analyze", return_value=[_obt_analysis("møte")]),
        mock.patch.object(morph_svc, "set_ready", side_effect=publish_readiness),
    ):
        morph_svc.main()
