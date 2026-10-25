from __future__ import annotations

from multiprocessing.connection import Connection


def run_mtag(word: str, connection: Connection) -> None:
    import mtag_worker

    mtag_worker.run_mtag(word, connection)
