# Generated reading

PostgreSQL owns generation requests, claims, outcomes, and temporary results. Polling,
worker admission, and cleanup use the same creation-time TTL. Expired processing rows
become failed, and expired topic, title, text, and pages are cleared while observability
fields remain.

Funded provider admission commits before dispatch. Preflight and dispatch build the same
provider request, so the debit matches the request sent. A failed, cancelled, or
abandoned call keeps its debit.

The topic is untrusted subject data. It cannot override system instructions for
language, length, or required vocabulary.

Generation status announces its title, message, and stalled transition through one polite
live region. Keep the elapsed-time counter outside that region to avoid repeated
announcements.

Generation owns provider work and temporary results. Reading owns persistent
materialization through its import service. Generation does not consume an import slot;
importing does. Account deletion cascades generation rows.
