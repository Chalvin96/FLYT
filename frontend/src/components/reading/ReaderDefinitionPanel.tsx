import { Button } from '@flyt/ui';
import { X } from 'lucide-react';

import type { ReaderWord } from './readerVocabulary';
import { ReaderWordList } from './ReaderWordList';
import { ReaderWordLookup } from './ReaderWordLookup';

export function ReaderDefinitionPanel({
  words,
  selectedWord,
  onSelect,
  onClose,
  easierStoryNotice,
  wordListAvailable = true,
}: {
  words: readonly ReaderWord[];
  selectedWord?: ReaderWord;
  onSelect: (word: ReaderWord) => void;
  onClose: () => void;
  easierStoryNotice?: React.ReactNode;
  wordListAvailable?: boolean;
}) {
  if (!selectedWord)
    return (
      <ReaderWordList
        words={words}
        onSelect={onSelect}
        easierStoryNotice={easierStoryNotice}
      />
    );
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="definition-panel"
    >
      <div className="flex shrink-0 items-center justify-between px-5 pt-3">
        {wordListAvailable && (
          <Button variant="link" onClick={onClose}>
            Back to word list
          </Button>
        )}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close word lookup"
            onClick={onClose}
          >
            <X aria-hidden />
          </Button>
        </div>
      </div>
      <ReaderWordLookup word={selectedWord} onClose={onClose} />
    </div>
  );
}
