# Reading

Curated/public stories are visible when `Story.is_ready`; private imports are visible to their owner when `ImportMeta.status` is ready. Progress and annotations are learner-owned. Reading owns persistent curated and imported content, import models, HTTP endpoints, workers, and import normalization.

Import admission is idempotent by normalized content hash, lifetime quota, and advisory lock ordering. Ingress commits before publish/enqueue; finalize commits the ready/failed state after page construction. Duplicate imports do not debit quota. Pages reuse prebuilt generated pages when they reconstruct normalized text and fall back safely when they do not.

Worker jobs use stale/retry thresholds and preserve pending/processing/ready/failed API states. Retry and requeue are safe to repeat. Generated-story import uses the public `ImportService.create_from_generation` and `finalize_import` methods; do not invent a second materializer or retokenize a ready story unnecessarily.

Private source context remains private; public readiness and ownership checks stay distinct.
