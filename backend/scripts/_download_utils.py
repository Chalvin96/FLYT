"""Shared download and tarball utilities for seed/import scripts."""

from __future__ import annotations

import tarfile
import tempfile
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlparse

import httpx


DOWNLOAD_TIMEOUT = httpx.Timeout(connect=30.0, read=300.0, write=60.0, pool=60.0)


def is_remote_source(source: str) -> bool:
    parsed = urlparse(source)
    return parsed.scheme == "https"


def is_local_tarball(path: Path) -> bool:
    return path.is_file() and path.name.endswith(".tar.gz")


def safe_extract_tarball(archive_path: Path, target_dir: Path) -> None:
    resolved_target = target_dir.resolve()
    with tarfile.open(archive_path, "r:gz") as archive:
        safe_members = []
        for member in archive.getmembers():
            member_path = (target_dir / member.name).resolve()
            if (
                resolved_target not in member_path.parents
                and member_path != resolved_target
            ):
                raise ValueError(f"Unsafe tar member path: {member.name}")
            safe_members.append(member)
        archive.extractall(target_dir, members=safe_members, filter="data")


def download_tarball(url: str, destination: Path) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"URL must be https: {url}")

    with httpx.Client(follow_redirects=True, timeout=DOWNLOAD_TIMEOUT) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            with destination.open("wb") as output:
                for chunk in response.iter_bytes():
                    output.write(chunk)


def _is_lemma_json(path: Path) -> bool:
    return path.stem.isdigit()


def find_lemma_directory(root_dir: Path) -> Path:
    """Locate the lemma JSON directory inside an extracted archive."""
    direct = root_dir / "lemma"
    if direct.is_dir() and any(_is_lemma_json(p) for p in direct.glob("*.json")):
        return direct
    if any(_is_lemma_json(p) for p in root_dir.glob("*.json")):
        return root_dir
    numeric_files = sorted(
        (p for p in root_dir.rglob("*.json") if _is_lemma_json(p)),
        key=lambda p: int(p.stem),
    )
    if numeric_files:
        return numeric_files[0].parent
    raise ValueError(f"No lemma JSON directory found in {root_dir}")


@contextmanager
def resolve_data_dir(source: str) -> Generator[Path, None, None]:
    """Yield a Path to a lemma JSON directory from a dir, tarball, or URL."""
    path = Path(source)

    if path.exists() and path.is_dir():
        yield find_lemma_directory(path)
        return

    with tempfile.TemporaryDirectory(prefix="ordbokene-seed-") as tmp:
        temp_dir = Path(tmp)

        if path.exists() and is_local_tarball(path):
            archive_path = path
        elif is_remote_source(source):
            archive_path = temp_dir / "download.tar.gz"
            print(f"Downloading {source}...")
            download_tarball(source, archive_path)
        else:
            raise ValueError(
                "Source must be a directory, a local .tar.gz file, or an https URL"
            )

        extract_dir = temp_dir / "extract"
        extract_dir.mkdir()
        print(f"Extracting {archive_path.name}...")
        safe_extract_tarball(archive_path, extract_dir)
        yield find_lemma_directory(extract_dir)
