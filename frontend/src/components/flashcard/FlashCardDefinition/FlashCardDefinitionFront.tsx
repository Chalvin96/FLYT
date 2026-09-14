import { PronunciationRow } from '@flyt/lexicon';
import { memo } from 'react';

interface FlashCardDefinitionFrontProps {
  word?: string;
  /** Norwegian sense cue for homograph disambiguation; pre-resolved by the card builder. */
  senseCue?: string | null;
  audioUrl?: string | null;
}

const FlashCardDefinitionFrontComponent = ({
  word,
  senseCue,
  audioUrl,
}: FlashCardDefinitionFrontProps) => {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-4 py-6 text-center sm:px-5 sm:py-8">
      <div className="max-w-text">
        <h2 className="break-words text-balance font-display type-display-lg font-medium text-foreground">
          {word}
        </h2>
        {senseCue ? (
          <p
            className="mt-3 type-caption italic text-muted-foreground"
            lang="no"
          >
            {senseCue}
          </p>
        ) : null}
        {audioUrl ? (
          <div className="mt-5 flex justify-center">
            <PronunciationRow audioUrl={audioUrl} size="md" />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const FlashCardDefinitionFront = memo(FlashCardDefinitionFrontComponent);
