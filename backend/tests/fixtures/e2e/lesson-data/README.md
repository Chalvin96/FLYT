# E2E lesson import fixture (export v4)

Committed subset of the real lesson-data export in the v4 `dist/` layout:
`dist/catalog.json`, `dist/schema/lesson.schema.json`, catalog-referenced
packets, and synthesized audio metadata with hosted HTTPS URLs. The importer
does not require or stage local audio files.

The first packet, `operations_tour`, is synthetic and exercises all nine v4
operations, a named dialogue, nullable write bounds, and multiple audio
surfaces. The import contract accepts only the `synthesized` audio status;
obsolete `pending`/`unavailable` entries are rejected at import. The remaining
packets provide enough practice groups for E2E review seeding
(`cardinal_numbers` backs the deterministic learner seed). This is a
consumer-contract fixture, not a byte-for-byte snapshot of the producer's
current full export: it has a local synthetic packet, a deliberately small
catalog, and fixture-specific packet/schema snapshots.

## Provenance and refresh

The producer now validates and packages the complete `dist/` tree, including
the catalog and generated schema. When refreshing, start from a validated v4
release at producer commit
`29de7b26b47f38899dce59ccb9e99893e8b05b92`, select the intended packet subset,
reapply the synthetic `operations_tour` packet and its two tiny WAV assets,
retain the `cardinal_numbers` and `adjective_agreement` packets, and record any
fixture-specific changes in this README. The committed
`adjective_agreement.json` packet started from the producer file at
`~/norsk-lesson-data/dist/lessons/`; Flyt normalizes its example content into
singular `example` blocks, so its current SHA-256 is
`b6710031595a9acfd67d5eb7c8f216deea2a630c6b76db9d093436a0ae0d45e6`. The
packets carry the required ordered `content` reference array, and
`operations_tour.json` gained a synthetic `content` array and dropped its
obsolete `word_list` block to match the v4 contract. The bundled schema artifact
is regenerated from Flyt's strict `LessonPacket` model. Record any other
fixture-specific changes in this README.
Then run:

```bash
uv run pytest tests/integration/test_lesson_import_smoke.py -q
```
