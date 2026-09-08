import { PronunciationRow } from '@flyt/lexicon';
import { memo } from 'react';

interface FlashCardDefinitionFrontProps {
  word?: string;
  /** Norwegian sense cue for homograph disambiguation; pre-resolved by the card builder. */
  senseCue?: string | null;
  formattedPos?: string | null;
  ipaApproximate?: boolean;
  audioUrl?: string | null;
}

const FlashCardDefinitionFrontComponent = ({
  word,
  senseCue,
  formattedPos,
  ipaApproximate,
  audioUrl,
}: FlashCardDefinitionFrontProps) => {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-4 py-4 text-center sm:px-5 sm:py-5">
      <div className="max-w-text px-2">
        <h2 className="mt-4 break-words type-display-lg font-medium text-foreground">
          {word}
        </h2>
        {senseCue ? (
          <p className="type-caption mt-2 text-muted-foreground italic">
            {senseCue}
          </p>
        ) : null}
        {formattedPos ? (
          <p className="type-caption mt-3 text-muted-foreground">
            {formattedPos}
          </p>
        ) : null}
        {audioUrl ? (
          <div className="mt-3 flex justify-center">
            <PronunciationRow
              audioUrl={audioUrl}
              ipaApproximate={ipaApproximate}
              size="sm"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const FlashCardDefinitionFront = memo(FlashCardDefinitionFrontComponent);
