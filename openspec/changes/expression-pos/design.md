# Design: First class dictionary expressions

The backend, generated API types, shared lexicon package, frontend, and extension use the same expression POS value and `EXPR` badge. Fresh Alembic initialization includes the value; no incremental migration is needed for the fresh database workflow.

Lookup normalizes NFC and ordinary spaces, accepts Unicode letters, marks, digits, and the approved dictionary punctuation, and rejects controls, markup, and wildcard characters. Queries are capped at 80 characters. Suggestions preserve exact-match precedence, then rank ordinary headwords by frequency before unranked expressions, with deterministic lexical tie breaking and escaped prefix matching.

Bracket alternatives remain one canonical string. Presentation surfaces show `[a / b]`, while accessible labels and selection values retain the source string.
