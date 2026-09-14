# Lexicon expression support

## ADDED Requirements

### Requirement: Expressions are a first class lemma part of speech

The lexicon contract MUST represent dictionary expressions with the `expression` POS value and the `EXPR` display label across the fresh database schema, API types, importer, shared UI, and browser extension.

#### Scenario: An expression is imported

- **WHEN** a labeled Ordbøkene entry has `EXPR` as its part of speech and a bilingual definition
- **THEN** the importer stores one canonical multiword lemma with POS `expression`

### Requirement: Lookup accepts canonical dictionary expressions

Lookup MUST normalize NFC and ordinary spaces, accept Unicode letters, marks, digits, and the approved dictionary punctuation, reject controls, wildcard characters, markup, and empty or symbol-only values, and enforce an 80-character maximum. Invalid values MUST produce the canonical accessible validation error without issuing a request or submission.

#### Scenario: A punctuated expression is searched

- **WHEN** a user enters a valid expression containing brackets, an en dash, or an apostrophe
- **THEN** the normalized canonical expression is used for lookup and autocomplete

#### Scenario: An invalid expression is entered

- **WHEN** a user enters a newline, wildcard, markup, or an 81-character value
- **THEN** the UI marks the field invalid, explains the allowed input, and does not issue a request

### Requirement: Expression suggestions preserve meaning

Autocomplete MUST give exact matches precedence, rank ordinary headwords by frequency before unranked expressions, escape prefix wildcard characters, use deterministic ordering, and preserve the canonical headword for selection. Bracket alternatives MUST be presented readably while their accessible name and submitted value retain the canonical string.

#### Scenario: Bracket alternatives are displayed

- **WHEN** a canonical headword contains `[a|b]`
- **THEN** visual labels show `[a / b]` while accessible labels and selection values retain `[a|b]`
