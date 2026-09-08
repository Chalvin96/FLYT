# Flyt CPU STT service

Small internal HTTP service for Norwegian speech recognition. It loads the
Apache-2.0 `NbAiLab/nb-whisper-medium` checkpoint once, serves its converted
CTranslate2 INT8 artifact through `faster-whisper` on CPU, and keeps the service
private behind Flyt's backend.

This service is intended to run behind Flyt's private network boundary. It has
no public route, authentication, database, or audio/transcript persistence.
Browser clients must use the authenticated backend `POST /speech/transcribe`
proxy; they must never be configured with this service URL.

## Build and run

The default local build downloads the model and runs the CTranslate2
conversion. It is the expensive step; the final image contains the converted
model but not PyTorch or the conversion toolchain. The published CI path passes
a self-hosted, pre-converted tar bundle and verifies its SHA-256 before
extraction, so that build does not run the conversion step. A self-hosted tar
bundle can be supplied to any build to use the same path.

```bash
docker build -t flyt-stt stt-svc/
docker run --rm --name flyt-stt -p 127.0.0.1:8080:8080 flyt-stt
```

Build from the self-hosted bundle. The checksum is required and defaults to the
verified Flyt bundle digest in the Dockerfile; override both values together
for another self-hosted artifact:

```bash
docker build \
  --build-arg MODEL_BUNDLE_URL=https://media.umebocchi.my.id/models/nb/nb-whisper-medium-int8.tar.gz \
  --build-arg MODEL_BUNDLE_SHA256=c079d580abcfec05891c3b751dd1d697cb93abf7f6c1561c2dc8035c0e2894b9 \
  -t flyt-stt stt-svc/
```

The model source and revision can be changed deliberately:

```bash
docker build \
  --build-arg MODEL_ID=NbAiLab/nb-whisper-medium \
  --build-arg MODEL_REVISION=0ed074d5985bd56ca4140159a9dbffbc3fb5117e \
  -t flyt-stt stt-svc/
```

When supplying a custom converted bundle, pass a matching `MODEL_REVISION` if
the bundle was built from a different checkpoint revision so runtime health
metadata remains accurate.

Runtime settings are environment variables prefixed with `STT_`:

| Variable                    |                          Default | Purpose                                                  |
| --------------------------- | -------------------------------: | -------------------------------------------------------- |
| `STT_MODEL_PATH`            | `/models/nb-whisper-medium-int8` | Converted model directory                                |
| `STT_INFERENCE_WORKERS`     |                              `4` | CTranslate2 inference workers sharing one model          |
| `STT_MAX_CONCURRENCY`       |                              `4` | In-flight inference limit                                |
| `STT_CPU_THREADS`           |                              `1` | CPU threads per inference worker                         |
| `STT_BEAM_SIZE`             |                              `5` | Decoder beam size                                        |
| `STT_MAX_AUDIO_BYTES`       |                       `10485760` | Maximum upload size                                      |
| `STT_MAX_AUDIO_SECONDS`     |                             `20` | Maximum decoded duration                                 |
| `STT_MAX_QUEUE`             |                             `16` | Waiting admission limit in addition to active inferences |
| `STT_QUEUE_TIMEOUT_SECONDS` |                           `0.25` | Inference-slot wait before 503                           |

The container intentionally runs one Uvicorn process. Four Uvicorn processes
would load four model copies; `STT_INFERENCE_WORKERS` provides bounded
concurrency while sharing the loaded model. `STT_MAX_CONCURRENCY` active
requests plus `STT_MAX_QUEUE` waiting requests are admitted at once. Admission
is reserved before multipart parsing, so a full queue rejects without first
buffering the audio payload in the application. Requests beyond the admission
limit receive a retryable 503 immediately; admitted requests waiting for an
inference worker
use `STT_QUEUE_TIMEOUT_SECONDS` before receiving 503. The queue is in-process
and is not durable across restarts.

In Coolify, run one replica of this container on port 8080 and configure the
`STT_*` values as environment variables. Do not replace the Dockerfile command
with four Uvicorn workers; that would load four model copies.

The queue's worst-case payload memory is approximately
`(STT_MAX_CONCURRENCY + STT_MAX_QUEUE) * STT_MAX_AUDIO_BYTES`, in addition to
the model and inference working memory. On an 8 GiB host, benchmark two
workers with two threads against four workers with one thread before increasing
either queue or upload limits.

The multipart request body is bounded before form parsing to the audio limit
plus a small multipart envelope. The endpoint also checks the uploaded file
size after parsing, so chunked and regular requests receive the same 413 limit.

## API

```text
GET  /health/live
GET  /health/ready
POST /transcribe  multipart field: file
```

Example:

```bash
curl http://127.0.0.1:8080/health/ready
curl -F file=@sample.wav http://127.0.0.1:8080/transcribe
```

The transcription response contains `text`, `language`,
`language_probability`, `duration_seconds`, and ordered `segments`.

## Local development and benchmark

Install the service environment:

```bash
uv sync --directory stt-svc --group dev
```

Point the service at a local CTranslate2 conversion (for example, one created
with `ct2-transformers-converter`) and run it:

```bash
STT_MODEL_PATH=/tmp/flyt-nb-medium-ct2 \
  uv run --directory stt-svc uvicorn app:app --host 127.0.0.1 --port 8080
```

Benchmark with the model loaded once:

```bash
uv run --directory stt-svc python benchmark.py \
  --model-path /tmp/flyt-nb-medium-ct2 \
  /path/to/one.wav /path/to/two.wav
```

The output reports model-load time, per-file real-time factor, aggregate
real-time factor, and peak resident memory. Use representative Norwegian
speech before changing the default concurrency or model revision. A fixture
longer than the service's 20-second limit can be evaluated explicitly with
`--max-audio-seconds 30`; that flag is for benchmarking only.

## Small quality evaluation

`eval.py` is a manual, small WER harness rather than a CI test. Copy a few
representative Norwegian clips beside a manifest based on
`eval-manifest.example.jsonl`, replace the references with the spoken text, and
run:

```bash
uv run --directory stt-svc python eval.py eval-manifest.jsonl \
  --model-path /path/to/nb-whisper-medium-int8 \
  --max-files 8
```

It loads one model, reports aggregate and per-clip word error rate, and applies
the same lowercase/punctuation normalization to references and hypotheses. A
missing, undecodable, or too-long clip is reported as a failed item while the
remaining clips continue.
Keep a small fixed manifest outside CI so a model, decoder, or service-setting
change can be compared against the same learner-like clips without adding audio
fixtures to the repository.

## Why faster-whisper is faster

`faster-whisper` is not a different speech model here: it uses the same
NB-Whisper weights after conversion. The speed comes from the CTranslate2
runtime, which executes the encoder/decoder in optimized native C++ kernels,
uses CPU-friendly INT8 weights and operations, and avoids carrying the full
PyTorch inference stack in the serving process. It also avoids Python work in
the hot tensor loops. The tradeoff is a conversion step, a CTranslate2 model
format, and the need to validate decoding settings and quality after
quantization.

The service disables previous-text conditioning and enables VAD for short
exercise utterances to reduce repeated segments. These settings improve
request isolation but do not replace a real Norwegian WER evaluation.

## Delivery and provenance

The path-filtered [STT workflow](../.github/workflows/stt.yml) validates image
builds on matching pull requests and publishes on matching master pushes.
It fetches the checksum-pinned bundle above; credentials must not be baked
into the image. Gate traffic on `/health/ready`, restart on model-load failure,
and monitor resident memory and 503 saturation before raising admission limits.

The backend owns authentication, upload limits, and learner rate limits.
Configure `STT_SVC_URL` there; the service itself must remain private.
Tune the backend's `STT_PROXY_*` limits alongside this service's admission
limits so adding API replicas cannot create unbounded model load.

[NOTICE.md](NOTICE.md) records the upstream model revision and runtime
attribution. The image ships the [Apache-2.0 license](Apache-2.0.txt) with the
model. Keep that provenance when changing the checkpoint or converted bundle.
