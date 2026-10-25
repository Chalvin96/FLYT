import { Text } from '@flyt/ui';
import { Check, Minus } from 'lucide-react';
import { useRef, useState } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import type { Exercise } from '@/types/lesson-contracts';

import { AnswerOption } from '../AnswerOption/AnswerOption';
import { resolveAnswerOptionState } from '../AnswerOption/answerOptionState';
import { OperationShell, stimulusSentenceClassName } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type ChooseExercise = Extract<Exercise, { operation: 'choose' }>;

export function FlashCardChoose({
  exercise,
  allowRetry,
  onFinished,
  ...props
}: OperationComponentProps<ChooseExercise>) {
  const options = exercise.payload.options;
  const [selected, setSelected] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
    checkExercise(selected === exercise.payload.answer_id);
  }

  function selectIndex(nextIndex: number) {
    const normalizedIndex = (nextIndex + options.length) % options.length;
    selectOption(options[normalizedIndex]?.option_id ?? null, normalizedIndex);
    optionRefs.current[normalizedIndex]?.focus();
  }

  function selectOption(optionId: string | null, index: number) {
    if (selected !== optionId) markDirty();
    setActiveIndex(index);
    setSelected(optionId);
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
      instruction="Pick the best option."
      onCheck={check}
      onContinue={finish}
      {...props}
    >
      {exercise.payload.stem ? (
        <div className={stimulusSentenceClassName}>
          <Text
            as="p"
            id="choose-stem"
            data-testid="choose-stem"
            size="fluid"
            tone="default"
          >
            <SpanView spans={exercise.payload.stem} />
          </Text>
        </div>
      ) : null}
      <div
        role="radiogroup"
        aria-label="Answer options"
        aria-describedby={exercise.payload.stem ? 'choose-stem' : undefined}
        className="flex flex-col gap-2"
      >
        {options.map((option, index) => {
          const checked = selected === option.option_id;
          const isAnswer = option.option_id === exercise.payload.answer_id;
          const graded = Boolean(result);
          const state = resolveAnswerOptionState({ checked, graded, isAnswer });
          const isTabbable = !graded && (checked || activeIndex === index);
          const letterKey = String.fromCharCode('A'.charCodeAt(0) + index);
          return (
            <AnswerOption
              key={option.option_id}
              checked={checked}
              detail={graded ? option.why : undefined}
              disabled={graded}
              label={option.text}
              marker={
                state === 'correct' ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : state === 'incorrect' ? (
                  <Minus aria-hidden="true" className="size-4" />
                ) : (
                  letterKey
                )
              }
              onClick={() => {
                selectOption(option.option_id, index);
              }}
              onKeyDown={(event) => handleRadioKeyDown(event, index)}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              state={state}
              tabIndex={isTabbable ? 0 : -1}
            />
          );
        })}
      </div>
    </OperationShell>
  );
}
