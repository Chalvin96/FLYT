import { memo } from 'react';

import type { StoryParagraph } from './storyParagraphs';
import { WordSpan } from './WordSpan';

const WORD_TOKEN_PATTERN = /\p{L}/u;

interface StoryParagraphViewProps {
  paragraph: StoryParagraph;
  paragraphIndex: number;
  onOpenLemma: (lemmaUuid: string | null, text: string) => void;
}

function StoryParagraphViewComponent({
  paragraph,
  paragraphIndex,
  onOpenLemma,
}: StoryParagraphViewProps) {
  return (
    <p className="whitespace-pre-wrap">
      {paragraph.map((part, partIndex) => {
        const partKey = `${part.isToken ? 'token' : 'text'}-${paragraphIndex}-${partIndex}-${part.text}-${part.lemmaUuid ?? ''}`;
        if (!part.isToken || !WORD_TOKEN_PATTERN.test(part.text)) {
          return <span key={partKey}>{part.text}</span>;
        }

        return (
          <WordSpan
            key={partKey}
            text={part.text}
            state={part.state}
            hasLemma={part.lemmaUuid !== null}
            isInteractive
            onClick={() => onOpenLemma(part.lemmaUuid, part.text)}
          />
        );
      })}
    </p>
  );
}

export const StoryParagraphView = memo(StoryParagraphViewComponent);
