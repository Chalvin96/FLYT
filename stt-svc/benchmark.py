from __future__ import annotations

import argparse
import json
import resource
import time
from dataclasses import replace
from pathlib import Path

from app import Settings, SpeechRecognizer


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark the local CPU STT model")
    parser.add_argument("audio", nargs="+", type=Path)
    parser.add_argument("--model-path", type=Path)
    parser.add_argument("--threads", type=int)
    parser.add_argument("--max-audio-seconds", type=float)
    args = parser.parse_args()

    settings = Settings.from_env()
    if args.model_path:
        settings = replace(settings, model_path=args.model_path)
    if args.threads is not None:
        settings = replace(settings, cpu_threads=max(1, args.threads))
    if args.max_audio_seconds is not None:
        settings = replace(settings, max_audio_seconds=max(0.1, args.max_audio_seconds))

    recognizer = SpeechRecognizer(settings)
    load_started = time.perf_counter()
    recognizer.load()
    load_seconds = time.perf_counter() - load_started
    if not recognizer.ready:
        raise SystemExit(f"model could not be loaded from {settings.model_path}")

    results = []
    total_audio_seconds = 0.0
    total_inference_seconds = 0.0
    for path in args.audio:
        payload = path.read_bytes()
        started = time.perf_counter()
        transcription = recognizer.transcribe(payload)
        elapsed = time.perf_counter() - started
        total_audio_seconds += transcription.duration_seconds
        total_inference_seconds += elapsed
        results.append(
            {
                "file": str(path),
                "audio_seconds": round(transcription.duration_seconds, 3),
                "elapsed_seconds": round(elapsed, 3),
                "real_time_factor": round(elapsed / transcription.duration_seconds, 3),
                "text": transcription.text,
            }
        )

    print(
        json.dumps(
            {
                "model_path": str(settings.model_path),
                "model_revision": settings.model_revision,
                "load_seconds": round(load_seconds, 3),
                "total_audio_seconds": round(total_audio_seconds, 3),
                "total_inference_seconds": round(total_inference_seconds, 3),
                "real_time_factor": round(total_inference_seconds / total_audio_seconds, 3),
                "max_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
