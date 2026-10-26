import { memo } from 'react';

import type { StoryParagraph } from './storyParagraphs';
import { WordSpan } from './WordSpan';

const WORD_TOKEN_PATTERN = /\p{L}/u;
const CLOSING_PUNCTUATION = /^[.,!?;:%)\]»”’]+/u;

interface StoryParagraphViewProps {
  paragraph: StoryParagraph;
  paragraphIndex: number;
  currentWordKey?: string;
  onOpenLemma: (
    lemmaUuid: string | null,
    text: string,
    wordKey: string,
  ) => void;
}

function StoryParagraphViewComponent({
  paragraph,
  paragraphIndex,
  currentWordKey,
  onOpenLemma,
}: StoryParagraphViewProps) {
  return (
    <p className="whitespace-pre-wrap">
      {paragraph.map((part, partIndex) => {
        const partKey = `${part.isToken ? 'token' : 'text'}-${paragraphIndex}-${partIndex}-${part.text}-${part.lemmaUuid ?? ''}`;
        if (!part.isToken || !WORD_TOKEN_PATTERN.test(part.text)) {
          const preceding = paragraph[partIndex - 1];
          const text =
            preceding?.isToken && WORD_TOKEN_PATTERN.test(preceding.text)
              ? part.text.replace(CLOSING_PUNCTUATION, '')
              : part.text;
          return <span key={partKey}>{text}</span>;
        }

        const following = paragraph[partIndex + 1];
        const punctuation =
          following &&
          (!following.isToken || !WORD_TOKEN_PATTERN.test(following.text))
            ? (following.text.match(CLOSING_PUNCTUATION)?.[0] ?? '')
            : '';
        return (
          <WordSpan
            key={partKey}
            text={part.text + punctuation}
            state={part.state}
            hasLemma={part.lemmaUuid !== null}
            isInteractive
            current={currentWordKey === `${paragraphIndex}-${partIndex}`}
            onClick={() =>
              onOpenLemma(
                part.lemmaUuid,
                part.text,
                `${paragraphIndex}-${partIndex}`,
              )
            }
          />
        );
      })}
    </p>
  );
}

export const StoryParagraphView = memo(StoryParagraphViewComponent);
