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

type JudgeExercise = Extract<Exercise, { operation: 'judge' }>;

/** Verdict options, in render order. Index 0 is tabbable when none chosen. */
const VERDICTS = [true, false] as const;

export function FlashCardJudge(props: OperationComponentProps<JudgeExercise>) {
  return (
    <ExerciseModeProvider allowRetry={false}>
      <FlashCardJudgeOneShot {...props} />
    </ExerciseModeProvider>
  );
}

function FlashCardJudgeOneShot({
  exercise,
  onFinished,
  ...props
}: OperationComponentProps<JudgeExercise>) {
  const [selected, setSelected] = useState<boolean | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { result, check: checkExercise } = useCheckableExercise();

  function check() {
    checkExercise(selected === exercise.payload.is_correct);
  }

  function handleContinue() {
    if (result) {
      onFinished?.(gradedOutcome(result));
    }
  }

  /** Roving select: move focus + selection between the two radios. */
  function selectIndex(nextIndex: number) {
    const normalized = (nextIndex + VERDICTS.length) % VERDICTS.length;
    setActiveIndex(normalized);
    setSelected(VERDICTS[normalized]);
    radioRefs.current[normalized]?.focus();
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
      desktopExpanded
      result={result}
      canCheck={selected !== null}
      instruction="Read the Norwegian sentence, then decide: is it grammatically correct?"
      onCheck={check}
      onContinue={handleContinue}
      {...props}
    >
      <div
        id="judge-stimulus"
        data-testid="judge-stimulus"
        className={`${stimulusSentenceClassName} flex flex-col gap-2`}
      >
        <p className="type-label text-muted-foreground">The sentence</p>
        <p lang="no">
          <SpanView spans={exercise.payload.sentence} />
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Is this Norwegian sentence grammatically correct?"
        aria-describedby="judge-stimulus"
        className="grid gap-2"
      >
        {VERDICTS.map((value, index) => {
          const checked = selected === value;
          const isCorrect = result && value === exercise.payload.is_correct;
          const isWrong = result && checked && !isCorrect;
          const label = value ? 'The sentence is correct' : 'It has an error';
          const isTabbable = !result && (checked || activeIndex === index);

          return (
            <Button
              key={String(value)}
              ref={(node) => {
                radioRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={result ? -1 : isTabbable ? 0 : -1}
              disabled={Boolean(result)}
              variant="outline"
              className={cn(
                'radius-field shadow-tile type-body h-auto w-full justify-start whitespace-normal border-2 py-3 text-left',
                'disabled:opacity-100',
                !checked &&
                  !isCorrect &&
                  !isWrong &&
                  'border-border bg-card text-foreground',
                checked &&
                  !result &&
                  'tint-selected ring-selected ring-2 ring-offset-2',
                isCorrect && 'border-accent-20 bg-accent-0 text-accent-90',
                isWrong &&
                  'border-destructive-20 bg-destructive-0 text-destructive-80',
              )}
              onClick={() => {
                setActiveIndex(index);
                setSelected(value);
              }}
              onKeyDown={(event) => handleRadioKeyDown(event, index)}
            >
              {isCorrect ? (
                <Check aria-hidden="true" className="shrink-0 text-accent-80" />
              ) : isWrong ? (
                <X
                  aria-hidden="true"
                  className="shrink-0 text-destructive-80"
                />
              ) : null}
              <span>{label}</span>
              {isCorrect ? (
                <span className="sr-only"> — correct answer</span>
              ) : isWrong ? (
                <span className="sr-only"> — your answer was incorrect</span>
              ) : null}
            </Button>
          );
        })}
      </div>
      {result && !exercise.payload.is_correct && exercise.payload.feedback ? (
        <div className="radius-field border border-border bg-card p-4">
          <p className="type-label text-muted-foreground">Correction</p>
          <p lang="no" className="type-body mt-2 font-medium">
            {exercise.payload.feedback}
          </p>
        </div>
      ) : null}
    </OperationShell>
  );
}
