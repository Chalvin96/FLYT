import { describe, expect, it } from 'vitest';

import { getPageVocabulary, getReaderWords } from './readerVocabulary';
import type { StoryParagraph } from './storyParagraphs';

const paragraphs: StoryParagraph[] = [
  [
    { text: 'Ida drikker ', isToken: false, lemmaUuid: null, state: 'new' },
    { text: 'kaffe', isToken: true, lemmaUuid: 'kaffe', state: 'learning' },
    { text: '. ', isToken: false, lemmaUuid: null, state: 'new' },
    { text: 'Kaffen', isToken: true, lemmaUuid: 'kaffe', state: 'learning' },
    { text: ' er varm? ', isToken: false, lemmaUuid: null, state: 'new' },
    { text: 'Ikkje', isToken: true, lemmaUuid: null, state: 'new' },
    { text: ' no.', isToken: false, lemmaUuid: null, state: 'new' },
  ],
];
describe('readerVocabulary', () => {
  it('test_reader_words_given_repeated_lemma_expect_distinct_occurrences_and_sentences', () => {
    const result = getReaderWords(paragraphs);
    expect(result.map((word) => [word.key, word.text, word.sentence])).toEqual([
      ['0-1', 'kaffe', 'Ida drikker kaffe.'],
      ['0-3', 'Kaffen', 'Kaffen er varm?'],
      ['0-5', 'Ikkje', 'Ikkje no.'],
    ]);
  });
  it('test_page_vocabulary_given_repeated_and_unresolved_words_expect_unique_dictionary_entries', () => {
    expect(getPageVocabulary(getReaderWords(paragraphs))).toEqual([
      {
        key: '0-1',
        text: 'kaffe',
        lemmaUuid: 'kaffe',
        state: 'learning',
        sentence: 'Ida drikker kaffe.',
      },
    ]);
  });
});
