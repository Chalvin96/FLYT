import { PronunciationRow } from '@flyt/lexicon';
import { Text } from '@flyt/ui';
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
        <div className="break-words text-balance">
          <Text as="h2" size="4xl" weight="semibold" tone="default">
            {word}
          </Text>
        </div>
        {senseCue ? (
          <div className="mt-3 italic">
            <Text as="p" lang="no" size="medium" tone="subtle">
              {senseCue}
            </Text>
          </div>
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
