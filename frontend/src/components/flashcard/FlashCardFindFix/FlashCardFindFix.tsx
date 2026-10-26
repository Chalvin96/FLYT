import { Heading, Text } from '@flyt/ui';
import { useRef, useState } from 'react';

import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import {
  answerVerdictStatusText,
  verdictWordClass,
  type ChoiceVerdict,
} from '../answerVerdict';
import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type FindFixExercise = Extract<Exercise, { operation: 'find_fix' }>;

export function FlashCardFindFix({
  exercise,
  allowRetry,
  onFinished,
  ...props
}: OperationComponentProps<FindFixExercise>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { tokens } = exercise.payload;
  const {
    phase,
    result,
    dirty,
    canReveal,
    shakeKey,
    reveal,
    markDirty,
    check: checkExercise,
    finish,
  } = useExerciseAttempt({ allowRetry, onFinished });

  function check() {
    checkExercise(selected === exercise.payload.error_token_id);
  }

  function selectToken(tokenId: string) {
    if (selected !== tokenId) markDirty();
    setSelected(tokenId);
  }

  function wordState(tokenId: string): ChoiceVerdict {
    if (!result) {
      return selected === tokenId ? 'selected' : 'idle';
    }
    if (tokenId === exercise.payload.error_token_id) {
      return 'correct';
    }
    if (selected === tokenId) {
      return 'incorrect';
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
      canCheck={selected !== null && (phase !== 'wrong' || dirty)}
      attempt={
        allowRetry
          ? {
              kind: 'retry',
              phase,
              result,
              shakeKey,
              canReveal,
              onReveal: () => reveal(0),
            }
          : { kind: 'single', result }
      }
      instruction="Tap the word in the sentence that contains the error."
      onCheck={check}
      onContinue={finish}
      {...props}
    >
      <div className="radius-field mx-auto max-w-text bg-raised p-5 shadow-tile">
        <Text
          as="p"
          aria-label="Sentence to inspect"
          lang="no"
          size="large"
          tone="default"
        >
          {tokens.map((token, index) => {
            const state = wordState(token.token_id);
            const statusText = result
              ? answerVerdictStatusText[state]
              : undefined;
            return (
              <span key={token.token_id}>
                {index > 0 ? ' ' : null}
                <button
                  ref={(node) => {
                    buttonRefs.current[index] = node;
                  }}
                  type="button"
                  disabled={Boolean(result)}
                  data-state={state}
                  aria-pressed={selected === token.token_id}
                  aria-label={
                    statusText ? `${token.text}, ${statusText}` : token.text
                  }
                  tabIndex={index === focusedIndex ? 0 : -1}
                  className={cn(
                    'cursor-pointer rounded-sm px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-1 disabled:cursor-default',
                    verdictWordClass[state],
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
                  onClick={() => selectToken(token.token_id)}
                >
                  {token.text}
                </button>
              </span>
            );
          })}
        </Text>
      </div>
      {result ? (
        <div className="radius-field border border-default bg-raised p-4">
          <Heading as="div" size="xxsmall" tone="subtle">
            Correction
          </Heading>
          <div className="mt-2">
            <Text as="p" lang="no" size="large">
              {exercise.payload.feedback}
            </Text>
          </div>
        </div>
      ) : null}
    </OperationShell>
  );
}
