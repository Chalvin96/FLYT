import { useRef, useState } from 'react';

import { useCheckableExercise } from '@/hooks/flashcard/useCheckableExercise/useCheckableExercise';
import { gradedOutcome } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { ExerciseModeProvider } from '../ExerciseModeProvider';
import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type FindFixExercise = Extract<Exercise, { operation: 'find_fix' }>;

/**
 * Word state -> className. The exercise reads like a passage in a reading
 * app: comfortable prose, and tapping a word lays a highlighter mark over
 * it — no underline, no chip border, no lift. Resting words give only a
 * soft hover wash; the instructor line tells the user to tap. Result
 * states swap the mark colour in place: mint for the real error
 * (revealed), coral + strike for a wrong pick. Keyboard roving + aria +
 * data-state are preserved.
 */
type WordState = 'idle' | 'selected' | 'correct' | 'wrong';

const WORD_CLASSES: Record<WordState, string> = {
  idle: 'bg-secondary-10 text-foreground hover:bg-warning-10',
  selected: 'bg-warning-20 text-warning-90',
  correct: 'bg-primary-30 text-primary-90',
  wrong: 'bg-destructive-30 text-destructive-90 line-through decoration-2',
};

export function FlashCardFindFix(
  props: OperationComponentProps<FindFixExercise>,
) {
  return (
    <ExerciseModeProvider allowRetry={false}>
      <FlashCardFindFixOneShot {...props} />
    </ExerciseModeProvider>
  );
}

function FlashCardFindFixOneShot({
  exercise,
  onFinished,
  ...props
}: OperationComponentProps<FindFixExercise>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { tokens } = exercise.payload;
  const { result, check: checkExercise } = useCheckableExercise();

  function check() {
    checkExercise(selected === exercise.payload.error_token_id);
  }

  function handleContinue() {
    if (result) {
      onFinished?.(gradedOutcome(result));
    }
  }

  function wordState(tokenId: string): WordState {
    if (!result) {
      return selected === tokenId ? 'selected' : 'idle';
    }
    if (tokenId === exercise.payload.error_token_id) {
      return 'correct';
    }
    if (selected === tokenId) {
      return 'wrong';
    }
    return 'idle';
  }

  function moveFocus(nextIndex: number) {
    const boundedIndex =
      ((nextIndex % tokens.length) + tokens.length) % tokens.length;
    setFocusedIndex(boundedIndex);
    buttonRefs.current[boundedIndex]?.focus();
  }

  return (
    <OperationShell
      exercise={exercise}
      desktopExpanded
      result={result}
      canCheck={selected !== null}
      instruction="Tap the word in the sentence that contains the error."
      onCheck={check}
      onContinue={handleContinue}
      {...props}
    >
      <p
        aria-label="Sentence to inspect"
        lang="no"
        className="radius-field type-section mx-auto max-w-text bg-card p-5 leading-roomy text-foreground shadow-tile"
      >
        {tokens.map((token, index) => (
          <span key={token.token_id}>
            {index > 0 ? ' ' : null}
            <button
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              disabled={Boolean(result)}
              data-state={wordState(token.token_id)}
              aria-pressed={selected === token.token_id}
              aria-label={token.text}
              tabIndex={index === focusedIndex ? 0 : -1}
              className={cn(
                'cursor-pointer rounded px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-default',
                WORD_CLASSES[wordState(token.token_id)],
              )}
              onFocus={() => setFocusedIndex(index)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  moveFocus(index + 1);
                }
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  moveFocus(index - 1);
                }
              }}
              onClick={() => setSelected(token.token_id)}
            >
              {token.text}
            </button>
          </span>
        ))}
      </p>
      {result ? (
        <div className="radius-field border border-border bg-card p-4">
          <p className="type-label text-muted-foreground">Correction</p>
          <p lang="no" className="type-body mt-2">
            {exercise.payload.feedback}
          </p>
        </div>
      ) : null}
    </OperationShell>
  );
}
