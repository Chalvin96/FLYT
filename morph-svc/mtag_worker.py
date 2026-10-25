from __future__ import annotations

import importlib
import io
import os
import runpy
import sys
from multiprocessing.connection import Connection

K_OBT_DIR = "/app/The-Oslo-Bergen-Tagger"
sys.path.insert(0, os.path.join(K_OBT_DIR, "mtag"))

_FULLFORMS = importlib.import_module("fullform_bm").fullformHash
_COMPOUNDS = importlib.import_module("compounds_bm").compoundHash
_ROOTS = importlib.import_module("root_bm").rootHash


def run_mtag(word: str, connection: Connection) -> None:
    output = io.StringIO()
    sys.stdin = io.TextIOWrapper(
        io.BytesIO((word + "\n").encode("utf-8")), encoding="utf-8"
    )
    sys.stdout = output
    sys.argv = ["mtag.py", "-wxml", "-l", "/tmp/mtag.log"]
    try:
        os.chdir(K_OBT_DIR)
        runpy.run_path("mtag/mtag.py", run_name="__main__")
        connection.send_bytes(output.getvalue().encode("utf-8"))
    finally:
        connection.close()
