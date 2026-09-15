# Generated reading

`Generation` rows in PostgreSQL store request parameters, worker claims, outcomes, generated text, and pages. Database updates order request supersession, worker claims, quota debit, and cancellation-safe finalization. Polling, worker admission, and content cleanup share a cutoff derived from `created_at` and `STORY_GENERATION_EPHEMERAL_TTL_HOURS`; expired jobs are not claimed or dispatched, and settlement marks stale processing rows failed while clearing expired topic/text/pages and retaining observability fields.

Admission and funded-quota refresh happen before each provider attempt, and the provider call follows the committed admission transaction. Admission and dispatch share one provider request contract, so the request debited is the request sent. Debits remain spent after provider failure, cancellation, or worker death. Ready results are returned through polling.

Generation owns provider execution and the temporary-to-import handoff. Reading owns persistent import materialization through its public service boundary, including page reuse/fallback and final visibility. Generation does not consume the lifetime reading-import quota; explicit import does. Account deletion cascades generation rows.
