import { Check, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/common/Button/Button';
import { SpanView } from '@/components/portable/SpanView';
import { useCheckableExercise } from '@/hooks/flashcard/useCheckableExercise/useCheckableExercise';
import { gradedOutcome } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { ExerciseModeProvider } from '../ExerciseModeProvider';
import { OperationShell, stimulusSentenceClassName } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type ChooseExercise = Extract<Exercise, { operation: 'choose' }>;

export function FlashCardChoose(
  props: OperationComponentProps<ChooseExercise>,
) {
  return (
    <ExerciseModeProvider allowRetry={false}>
      <FlashCardChooseOneShot {...props} />
    </ExerciseModeProvider>
  );
}

function FlashCardChooseOneShot({
  exercise,
  onFinished,
  ...props
}: OperationComponentProps<ChooseExercise>) {
  const options = exercise.payload.options;
  const [selected, setSelected] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { result, check: checkExercise } = useCheckableExercise();

  function check() {
    checkExercise(selected === exercise.payload.answer_id);
  }

  function handleContinue() {
    if (result) {
      onFinished?.(gradedOutcome(result));
    }
  }

  function selectIndex(nextIndex: number) {
    const normalizedIndex = (nextIndex + options.length) % options.length;
    setActiveIndex(normalizedIndex);
    setSelected(options[normalizedIndex]?.option_id ?? null);
    optionRefs.current[normalizedIndex]?.focus();
  }

  function handleRadioKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (result) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        selectIndex(index + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        selectIndex(index - 1);
        break;
      default:
        break;
    }
  }

  return (
    <OperationShell
      exercise={exercise}
      result={result}
      canCheck={selected !== null}
      instruction="Pick the option that best completes the prompt."
      onCheck={check}
      onContinue={handleContinue}
      {...props}
    >
      {exercise.payload.stem ? (
        <p
          id="choose-stem"
          data-testid="choose-stem"
          className={stimulusSentenceClassName}
        >
          <SpanView spans={exercise.payload.stem} />
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-label="Answer options"
        aria-describedby={exercise.payload.stem ? 'choose-stem' : undefined}
        className="flex flex-col gap-2"
      >
        {options.map((option, index) => {
          const checked = selected === option.option_id;
          const isCorrect =
            result && option.option_id === exercise.payload.answer_id;
          const isWrong = result && checked && !isCorrect;
          const isTabbable = !result && (checked || activeIndex === index);
          const letterKey = String.fromCharCode('A'.charCodeAt(0) + index);
          return (
            <Button
              key={option.option_id}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              data-checked={checked}
              tabIndex={result ? -1 : isTabbable ? 0 : -1}
              variant="outline"
              disabled={Boolean(result)}
              className={cn(
                'radius-field shadow-tile type-body h-auto w-full justify-start whitespace-normal border-2 py-3 text-left',
                // Keep revealed (correct/wrong) tones full-strength after Check.
                // Button's base `disabled:opacity-50` would otherwise fade the
                // locked options to ~50% and make them hard to read.
                'disabled:opacity-100',
                // Default (unchecked, pre-Check): clean tile.
                !checked &&
                  !isCorrect &&
                  !isWrong &&
                  'border-border bg-card text-foreground',
                // Selected (pre-Check): solid selected fill,
                // ring pulls the eye to the picked option.
                checked &&
                  !result &&
                  'tint-selected ring-selected ring-2 ring-offset-2',
                isCorrect && 'border-accent-20 bg-accent-0 text-accent-90',
                isWrong &&
                  'border-destructive-20 bg-destructive-0 text-destructive-80',
              )}
              onClick={() => {
                setActiveIndex(index);
                setSelected(option.option_id);
              }}
              onKeyDown={(event) => handleRadioKeyDown(event, index)}
            >
              <span className="flex w-full items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'type-caption rounded-full inline-flex h-7 w-7 shrink-0 items-center justify-center font-bold transition-colors',
                    result && isCorrect
                      ? 'bg-accent-20 text-accent-90'
                      : result && isWrong
                        ? 'bg-destructive-20 text-destructive-80'
                        : checked
                          ? 'bg-white-100/25 text-white-100'
                          : 'bg-secondary-20 text-secondary-90',
                  )}
                >
                  {result && isCorrect ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : result && isWrong ? (
                    <X aria-hidden="true" className="size-4" />
                  ) : (
                    letterKey
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span>{option.text}</span>
                  {result && option.why ? (
                    <span className="type-caption font-normal opacity-80">
                      {option.why}
                    </span>
                  ) : null}
                  {result && isCorrect ? (
                    <span className="sr-only"> — correct answer</span>
                  ) : result && isWrong ? (
                    <span className="sr-only">
                      {' '}
                      — your answer was incorrect
                    </span>
                  ) : null}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </OperationShell>
  );
}
