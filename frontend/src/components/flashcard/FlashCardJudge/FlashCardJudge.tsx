import { Heading, Text } from '@flyt/ui';
import { Check, Minus } from 'lucide-react';
import { useRef, useState } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import type { Exercise } from '@/types/lesson-contracts';

import { AnswerOption } from '../AnswerOption/AnswerOption';
import { resolveAnswerOptionState } from '../AnswerOption/answerOptionState';
import { OperationShell, stimulusSentenceClassName } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type JudgeExercise = Extract<Exercise, { operation: 'judge' }>;

const VERDICTS = [true, false] as const;

export function FlashCardJudge({
  exercise,
  allowRetry,
  onFinished,
  ...props
}: OperationComponentProps<JudgeExercise>) {
  const [selected, setSelected] = useState<boolean | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
    checkExercise(selected === exercise.payload.is_correct);
  }

  function selectIndex(nextIndex: number) {
    const normalized = (nextIndex + VERDICTS.length) % VERDICTS.length;
    selectVerdict(VERDICTS[normalized], normalized);
    radioRefs.current[normalized]?.focus();
  }

  function selectVerdict(verdict: boolean, index: number) {
    if (selected !== verdict) markDirty();
    setActiveIndex(index);
    setSelected(verdict);
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
      instruction="Read the Norwegian sentence, then decide: is it grammatically correct?"
      onCheck={check}
      onContinue={finish}
      {...props}
    >
      <div
        id="judge-stimulus"
        data-testid="judge-stimulus"
        className={`${stimulusSentenceClassName} flex flex-col gap-2`}
      >
        <Heading as="div" size="xxsmall" tone="subtle">
          The sentence
        </Heading>
        <Text as="p" lang="no" size="fluid" tone="default">
          <SpanView spans={exercise.payload.sentence} />
        </Text>
      </div>

      <div
        role="radiogroup"
        aria-label="Is this Norwegian sentence grammatically correct?"
        aria-describedby="judge-stimulus"
        className="grid gap-2"
      >
        {VERDICTS.map((value, index) => {
          const checked = selected === value;
          const graded = Boolean(result);
          const isAnswer = value === exercise.payload.is_correct;
          const state = resolveAnswerOptionState({ checked, graded, isAnswer });
          const label = value ? 'The sentence is correct' : 'It has an error';
          const isTabbable = !graded && (checked || activeIndex === index);

          return (
            <AnswerOption
              key={String(value)}
              checked={checked}
              disabled={graded}
              label={label}
              marker={
                state === 'correct' ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : state === 'incorrect' ? (
                  <Minus aria-hidden="true" className="size-4" />
                ) : undefined
              }
              onClick={() => {
                selectVerdict(value, index);
              }}
              onKeyDown={(event) => handleRadioKeyDown(event, index)}
              ref={(node) => {
                radioRefs.current[index] = node;
              }}
              state={state}
              tabIndex={isTabbable ? 0 : -1}
            />
          );
        })}
      </div>
      {result && !exercise.payload.is_correct && exercise.payload.feedback ? (
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
