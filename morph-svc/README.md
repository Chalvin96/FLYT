# morph-svc

Tiny HTTP wrapper over the [Oslo-Bergen Tagger](http://tekstlab.uio.no/obt-ny/) that
**decompounds / lemmatizes a single Norwegian word**. Pure morphology — **no database,
no product logic**. The backend's `/lexicons/resolve` compound-miss path calls this and
maps the returned head/lemma to a `lemma_uuid` via its own WordForm lookup.

Stdlib-only (`http.server`); runs on the OBT base image with no extra Python deps.

## Build & run

```bash
docker build -t morph-svc morph-svc/
docker run -p 127.0.0.1:8001:8001 morph-svc
```

## API

```
GET  /health                       -> {"status":"ok"}
POST /analyze  {"word":"innbyggerantall"}
  -> {"word":"innbyggerantall",
      "analyses":[{"lemma":"innbyggerantall","pos":"subst","is_compound":true,"head":"antall"}]}
```

Returns **all** OBT analyses (ambiguous words have several); the backend picks. `head` is
the compound head lemma (`null` for non-compounds). Bad input (not a single Norwegian
token) → 400.

## Deploy

**Image:** `ghcr.io/<owner>/flyt-tagger` (tags: `latest` + `sha-<short>`).

**CI:** Pushed automatically by `.github/workflows/tagger.yml` on changes to
`morph-svc/**` (so it does NOT rebuild on unrelated master pushes).

Run it as an **internal-only** service (no public domain). Set the backend's
`TAGGER_SVC_URL` to its internal address. The backend calls it only as an optional,
fail-open fallback after direct and spaCy-lemma resolution; it does not cache the
service response. Failed requests return no fallback candidates; normal dictionary
lookup remains available without this service.

Successful analyses are cached (1024, exact case). Concurrent misses for the same
word share one analysis; failures are not cached.

| Variable | Default | Meaning |
| --- | ---: | --- |
| `MORPH_MAX_CONCURRENT_ANALYSES` | `8` | Uncached analyses at once |
| `MORPH_SLOT_WAIT_SECONDS` | `1.0` | Wait for a slot, then 503 `busy` |
| `MORPH_ANALYSIS_DEADLINE_SECONDS` | `3.0` | Analysis budget, then 504 `analysis timeout` |

Keep the backend's `TAGGER_SVC_TIMEOUT_SECONDS` (5.0) above slot wait plus
deadline plus 0.5 s cleanup.

`/health` returns 503 until a startup analysis of `møter` succeeds (dictionary
preload takes about 4 s); broken resources exit non-zero.

Known limit: a frozen (alive but stuck) forkserver blocks analyses; restart the
service.

The upstream tagger and its resources come from the `textlab/obt:1.0` base
image, maintained by UiO Text Laboratory. Flyt's MIT license covers this HTTP
wrapper; retain the upstream image's own notices when redistributing it.
