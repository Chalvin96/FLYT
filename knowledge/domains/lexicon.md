# Lexicon

A lemma is identified by headword, part of speech, and homograph identity. Word forms point to lemmas; definitions and glosses belong to the lemma meaning. Never use a translated meaning as a lemma identity.

The imported Ordbokene artifact is producer-owned and versioned. Imports preserve source identity, release compatibility, primary translations, and pronunciation provenance. The shared `@flyt/lexicon` package is the frontend/extension component boundary; app-local adapters should not duplicate its exports.

Norwegian Kelly frequency ranks order word packs; the source has no CEFR column, so rank must not imply a CEFR level.

Saving a lemma carries sentence context privately to the learner's card. Source URLs are retained for reading imports but are not stored as lemma context.
