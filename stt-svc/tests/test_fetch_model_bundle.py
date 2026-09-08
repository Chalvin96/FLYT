from __future__ import annotations

import io
import tarfile

import pytest

from scripts.fetch_model_bundle import _extract


def _write_bundle(path, member_name: str) -> None:
    with tarfile.open(path, "w:gz") as archive:
        data = b"model"
        member = tarfile.TarInfo(member_name)
        member.size = len(data)
        archive.addfile(member, io.BytesIO(data))


def test_extract_given_safe_bundle_expect_file_in_destination(tmp_path) -> None:
    bundle = tmp_path / "model.tar.gz"
    destination = tmp_path / "models"
    _write_bundle(bundle, "nb-whisper-medium-int8/model.bin")

    _extract(bundle, destination)

    assert (destination / "nb-whisper-medium-int8/model.bin").read_bytes() == b"model"


def test_extract_given_traversal_path_expect_rejection(tmp_path) -> None:
    bundle = tmp_path / "model.tar.gz"
    _write_bundle(bundle, "../outside.txt")

    with pytest.raises(SystemExit, match="unsafe path"):
        _extract(bundle, tmp_path / "models")
