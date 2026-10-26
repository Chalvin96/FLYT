import pytest

from healthcheck import is_worker_process


@pytest.mark.parametrize(
    "main_process_args",
    [
        [
            "/app/.venv/bin/python",
            "/app/.venv/bin/arq",
            "flyt.worker.WorkerSettings",
            "",
        ],
        ["arq", "flyt.worker.WorkerSettings", ""],
    ],
)
def test_is_worker_process_given_arq_main_process_expect_true(
    main_process_args: list[str],
) -> None:
    assert is_worker_process(main_process_args) is True


def test_is_worker_process_given_uvicorn_main_process_expect_false() -> None:
    main_process_args = [
        "/app/.venv/bin/python",
        "/app/.venv/bin/uvicorn",
        "flyt.main:app",
        "",
    ]

    assert is_worker_process(main_process_args) is False
