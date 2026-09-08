from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass, replace
from pathlib import Path

from app import Settings, SpeechRecognizer
from exceptions import AudioDecodeError, AudioTooLongError


@dataclass(frozen=True)
class EvalItem:
    audio: Path
    reference: str


def normalize_text(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKC", text).casefold()
    normalized = re.sub(r"[^\w\s]", " ", normalized, flags=re.UNICODE)
    return normalized.split()


def word_errors(reference: list[str], hypothesis: list[str]) -> int:
    previous = list(range(len(hypothesis) + 1))
    for reference_word in reference:
        current = [previous[0] + 1]
        for index, hypothesis_word in enumerate(hypothesis, start=1):
            current.append(
                min(
                    current[index - 1] + 1,
                    previous[index] + 1,
                    previous[index - 1] + (reference_word != hypothesis_word),
                )
            )
        previous = current
    return previous[-1]


def read_manifest(path: Path, *, max_files: int) -> list[EvalItem]:
    items: list[EvalItem] = []
    for line_number, line in enumerate(path.read_text().splitlines(), start=1):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"invalid JSON on manifest line {line_number}: {exc}") from exc
        if not isinstance(entry, dict):
            raise SystemExit(f"manifest line {line_number} must be an object")
        audio = entry.get("audio")
        reference = entry.get("reference")
        if not isinstance(audio, str) or not isinstance(reference, str):
            raise SystemExit(
                f"manifest line {line_number} needs string 'audio' and 'reference' fields"
            )
        audio_path = Path(audio)
        if not audio_path.is_absolute():
            audio_path = path.parent / audio_path
        items.append(EvalItem(audio=audio_path, reference=reference))
        if len(items) == max_files:
            break
    if not items:
        raise SystemExit("manifest contains no evaluation items")
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a small Norwegian STT WER evaluation")
    parser.add_argument("manifest", type=Path, help="JSONL file with audio and reference fields")
    parser.add_argument("--model-path", type=Path)
    parser.add_argument("--max-files", type=int, default=8)
    parser.add_argument("--max-audio-seconds", type=float)
    args = parser.parse_args()
    if args.max_files < 1:
        raise SystemExit("--max-files must be positive")

    settings = Settings.from_env()
    if args.model_path:
        settings = replace(settings, model_path=args.model_path)
    if args.max_audio_seconds is not None:
        settings = replace(settings, max_audio_seconds=max(0.1, args.max_audio_seconds))

    items = read_manifest(args.manifest, max_files=args.max_files)
    recognizer = SpeechRecognizer(settings)
    recognizer.load()
    if not recognizer.ready:
        raise SystemExit(f"model could not be loaded from {settings.model_path}")

    results = []
    total_errors = 0
    total_reference_words = 0
    for item in items:
        try:
            reference_words = normalize_text(item.reference)
            transcription = recognizer.transcribe(item.audio.read_bytes())
        except (AudioDecodeError, AudioTooLongError, OSError) as exc:
            results.append(
                {
                    "audio": str(item.audio),
                    "reference": item.reference,
                    "error": type(exc).__name__,
                }
            )
            continue

        hypothesis_words = normalize_text(transcription.text)
        errors = word_errors(reference_words, hypothesis_words)
        total_errors += errors
        total_reference_words += len(reference_words)
        results.append(
            {
                "audio": str(item.audio),
                "reference": item.reference,
                "hypothesis": transcription.text,
                "word_errors": errors,
                "reference_words": len(reference_words),
                "wer": round(errors / max(len(reference_words), 1), 4),
            }
        )

    print(
        json.dumps(
            {
                "files": len(items),
                "evaluated_files": len(results) - sum("error" in result for result in results),
                "failed_files": sum("error" in result for result in results),
                "word_errors": total_errors,
                "reference_words": total_reference_words,
                "wer": round(total_errors / max(total_reference_words, 1), 4),
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
