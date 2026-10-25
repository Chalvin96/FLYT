# Lexicon

Lemma identity comes from the producer's article and lemma IDs. A word, part of speech,
and homograph number can still describe two distinct entries, so translated meaning is
not an identity key.

Verified expression aliases are alternate forms of their owning lemma. They resolve to
that same lemma and therefore share its learner state and card pool.

An expression keeps its canonical producer headword as source identity. Verified aliases
affect display and lookup, not identity; legacy entries fall back to the canonical form.

IPA, intonation, and audio come from the dictionary source. Browser synthesis would make
pronunciation depend on the learner's device.

Saving a lemma may attach its source sentence and title as private learner context. A
reading page's URL belongs to the imported story, not the lemma context.

Norwegian Kelly frequency ranks order word packs, but the source has no CEFR column.
Frequency rank must not be presented as a CEFR level.

On a direct lemma miss, the optional flyt-tagger suggests deinflected or decomposed
forms. Its client fails open to no candidates if the service fails.

The gender badge shows the Norwegian article because that is the form a learner must
produce: en, ei, or et. Inflection detection respects a known part of speech; a
determiner's neuter tag must not force it into a noun table.
