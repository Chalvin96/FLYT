import type { ReadingWordState } from '@/types/api';

import type { StoryParagraph } from './storyParagraphs';

export interface ReaderWord {
  key: string;
  text: string;
  lemmaUuid: string | null;
  state: ReadingWordState;
  sentence: string;
}

function sentenceAt(content: string, offset: number): string {
  const before = content.slice(0, offset);
  const start =
    Math.max(
      before.lastIndexOf('.'),
      before.lastIndexOf('!'),
      before.lastIndexOf('?'),
    ) + 1;
  const after = content.slice(offset).search(/[.!?](?:\s|$)/u);
  const end = after < 0 ? content.length : offset + after + 1;
  return content.slice(start, end).trim();
}

export function getReaderWords(
  paragraphs: readonly StoryParagraph[],
): ReaderWord[] {
  return paragraphs.flatMap((paragraph, paragraphIndex) => {
    const content = paragraph.map((part) => part.text).join('');
    let offset = 0;
    return paragraph.flatMap((part, partIndex) => {
      const start = offset;
      offset += part.text.length;
      if (!part.isToken || !/\p{L}/u.test(part.text)) return [];
      return [
        {
          key: `${paragraphIndex}-${partIndex}`,
          text: part.text,
          lemmaUuid: part.lemmaUuid,
          state: part.state,
          sentence: sentenceAt(content, start),
        },
      ];
    });
  });
}

export function getPageVocabulary(words: readonly ReaderWord[]): ReaderWord[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    if (word.lemmaUuid === null || seen.has(word.lemmaUuid)) return false;
    seen.add(word.lemmaUuid);
    return true;
  });
}
