# Lexicon

A lemma is identified by headword, part of speech, and homograph identity. Word forms point to lemmas; definitions and glosses belong to the lemma meaning. Never use a translated meaning as a lemma identity.

The imported Ordbokene artifact is producer-owned and versioned. Imports preserve source identity, release compatibility, primary translations, and pronunciation provenance. The shared `@flyt/lexicon` package is the frontend/extension component boundary; app-local adapters should not duplicate its exports.

Norwegian Kelly frequency ranks order word packs; the source has no CEFR column, so rank must not imply a CEFR level.

Saving a lemma carries sentence context privately to the learner's card. Source URLs are retained for reading imports but are not stored as lemma context.
Expression lemmas use the `expression` POS and retain the canonical multiword
headword, including source punctuation and bracket alternatives, as their
internal identity. A producer-verified primary display form and complete
alternatives are optional learner-facing forms; the importer validates and
de-duplicates them without expanding ambiguous punctuation. Legacy artifacts
without structured forms keep the canonical fallback.

Verified forms are stored in `lexicon_lemma_aliases` under the owning lemma.
Their NFC/case-folded values have exact and prefix indexes, and suggestions and
resolution search them with the canonical headword and word forms in bounded,
set-based SQL. Exact matches rank before prefixes, ties are deterministic, and
alias reads are eager-loaded so result rendering does not create N+1 queries.
Natural forms are used for visible and accessible learner-facing text. When an
expression has verified aliases, its canonical bracket or pipe headword is
suppressed from suggestions; the canonical value remains available for source
identity and direct resolution, while legacy rows use the fallback formatter.
