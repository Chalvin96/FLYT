# Reading

Curated stories and private imports have separate visibility rules. Curated stories are
public only when ready; an imported story is visible only to its owner after processing
succeeds.

Public readiness implies at least one persisted page. `ReadingService.set_story_ready`
checks this before publication. URL ingest commits an unready story and passes the
front-matter readiness request to `generate_story_pages`; the worker commits pages and
readiness together. Regeneration rejects an empty page batch before replacing existing
pages. Admin readiness edits use the same service, and page admin edits cannot change a
page's story. The development seed publishes through the worker; the JSON importer and
scale seed insert ready public stories and their pages in one transaction. Public
queries filter only visibility and readiness, without checking the page table.

Home previews select the newest six stories per theme through a LATERAL query and the
partial `ix_reading_stories_public_group_created_id` index on `(reading_group_id,
created_at, id)` for ready public stories. Recommendations retain their exact priority
order: unread, matching theme, matching CEFR level, then descending creation time and
story ID.

The large reading seed baseline uses PostgreSQL 17, 12 themes, 3,000 public stories, and
9,528 total pages. These are median execution times from five warm `EXPLAIN (ANALYZE,
BUFFERS)` runs after two warmups and `ANALYZE`.

| Statement | Execution time | Page rows read | Ranking work |
| --- | --- | --- | --- |
| Group counts for home and theme list | 0.995 ms | 0 | Counts 3,000 public stories |
| Home section ranking | 0.244 ms | 0 | Fetches 6 stories per theme, sorts 72 rows |
| Recommendations ranking | 2.120 ms | 0 | Sorts 2,999 eligible stories to return 3 |

Import admission is idempotent by normalized content hash, active quota, and advisory
lock ordering. Ingress commits before publish/enqueue; finalize commits the ready/failed
state after page construction. The 200-slot quota counts private import references
across all processing states, independently of list filters or pagination. Duplicate
imports consume no additional slot, and deletion frees a slot. Pages reuse prebuilt
generated pages when they reconstruct normalized text and fall back safely when they do
not.

Import creation caps normalized text at 10 MB. Curated URL ingest also caps raw response
bytes separately.

Reading time is calculated by the backend from stored word count. The frontend displays
the returned value and does not estimate it again.

Renaming an import updates only the learner's private title. It does not change the
shared story title or another learner's import.

Page requests clamp to the existing page range. An out-of-range link resolves to the
first or last available page instead of failing.

Import workers claim work atomically, so duplicate delivery does nothing. They publish
the completed page batch in a separate transaction; a failed build records failure
without exposing partial pages.

The extension extracts page text in the browser. Its service worker submits that text
and the source URL without fetching the page.
