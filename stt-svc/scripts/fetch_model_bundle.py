from __future__ import annotations

import argparse
import hashlib
import tarfile
from pathlib import Path
from urllib.request import Request, urlopen


def _download(url: str, output: Path) -> str:
    digest = hashlib.sha256()
    request = Request(url, headers={"User-Agent": "flyt-stt-model-fetch/1.0"})
    with urlopen(request, timeout=120) as response, output.open("wb") as stream:
        while chunk := response.read(1024 * 1024):
            stream.write(chunk)
            digest.update(chunk)
    return digest.hexdigest()


def _extract(bundle: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with tarfile.open(bundle, "r:gz") as archive:
        members = archive.getmembers()
        for member in members:
            member_path = (destination / member.name).resolve()
            if not member_path.is_relative_to(root):
                raise SystemExit(f"model bundle contains an unsafe path: {member.name}")
            if not member.isfile() and not member.isdir():
                raise SystemExit(f"model bundle contains an unsupported entry: {member.name}")
        archive.extractall(destination, filter="data")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download and verify a model bundle")
    parser.add_argument("--url", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--extract-to", type=Path)
    args = parser.parse_args()

    actual_sha256 = _download(args.url, args.output)
    if actual_sha256 != args.sha256.lower():
        args.output.unlink(missing_ok=True)
        raise SystemExit(
            f"model bundle checksum mismatch: expected {args.sha256}, got {actual_sha256}"
        )

    if args.extract_to:
        _extract(args.output, args.extract_to)
    print(f"downloaded model bundle sha256={actual_sha256}")


if __name__ == "__main__":
    main()
