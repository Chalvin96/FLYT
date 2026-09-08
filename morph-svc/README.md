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

The service caches successful analyses by exact case-sensitive input and does
not cache failures. It admits four subprocess analyses; excess requests receive 503. Keep the backend timeout below the subprocess deadline so a slow tagger
does not hold up annotation. For each annotation job, backend fan-out and
distinct unresolved words are bounded; see the tagger client for current limits.

The upstream tagger and its resources come from the `textlab/obt:1.0` base
image, maintained by UiO Text Laboratory. Flyt's MIT license covers this HTTP
wrapper; retain the upstream image's own notices when redistributing it.
