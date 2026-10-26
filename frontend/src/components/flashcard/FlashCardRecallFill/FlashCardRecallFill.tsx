import { Heading, Text } from '@flyt/ui';
import { Check, Minus } from 'lucide-react';
import { useRef, useState } from 'react';

import { SpanView } from '@/components/portable/SpanView';
import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { AnswerOption } from '../AnswerOption/AnswerOption';
import { resolveAnswerOptionState } from '../AnswerOption/answerOptionState';
import {
  answerVerdictStatusText,
  verdictBlankClass,
  type ChoiceVerdict,
} from '../answerVerdict';
import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type RecallFillExercise = Extract<Exercise, { operation: 'recall_fill' }>;

type BlankSegment = Extract<
  RecallFillExercise['payload']['segments'][number],
  { kind: 'blank' }
>;

export function FlashCardRecallFill({
  exercise,
  allowRetry,
  onFinished,
  ...props
}: OperationComponentProps<RecallFillExercise>) {
  const { segments } = exercise.payload;
  const blanks = segments.filter((s): s is BlankSegment => s.kind === 'blank');

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [activeByBlank, setActiveByBlank] = useState<Record<string, number>>(
    () => Object.fromEntries(blanks.map((b) => [b.blank_id, 0])),
  );
  const optionRefs = useRef<Record<string, Array<HTMLButtonElement | null>>>(
    {},
  );
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
  const isLocked = Boolean(result);

  const canCheck =
    blanks.every((b) => answers[b.blank_id] !== undefined) &&
    (phase !== 'wrong' || dirty);

  function check() {
    checkExercise(blanks.every((b) => answers[b.blank_id] === b.answer_index));
  }

  function handleReveal() {
    const correctCount = blanks.filter(
      (blank) => answers[blank.blank_id] === blank.answer_index,
    ).length;
    reveal(blanks.length === 0 ? 0 : correctCount / blanks.length);
  }

  function selectOption(blankId: string, optionIndex: number) {
    if (isLocked) return;
    if (answers[blankId] !== optionIndex) markDirty();
    setAnswers((curr) => ({ ...curr, [blankId]: optionIndex }));
    setActiveByBlank((curr) => ({ ...curr, [blankId]: optionIndex }));
  }

  function blankNumber(blankId: string): number {
    return blanks.findIndex((b) => b.blank_id === blankId) + 1;
  }

  function fillState(blank: BlankSegment): ChoiceVerdict {
    const filled = answers[blank.blank_id];
    if (filled === undefined) return 'idle';
    if (!result) return 'selected';
    return filled === blank.answer_index ? 'correct' : 'incorrect';
  }

  function moveActive(blank: BlankSegment, nextIndex: number) {
    const length = blank.options.length;
    const normalized = (nextIndex + length) % length;
    selectOption(blank.blank_id, normalized);
    optionRefs.current[blank.blank_id]?.[normalized]?.focus();
  }

  function handleRadioKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    blank: BlankSegment,
    index: number,
  ) {
    if (result) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        moveActive(blank, index + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        moveActive(blank, index - 1);
        break;
      default:
        break;
    }
  }

  function renderSlot(blank: BlankSegment) {
    const filled = answers[blank.blank_id];
    const state = fillState(blank);
    const statusText = result ? answerVerdictStatusText[state] : undefined;
    const label = [
      `Blank ${blankNumber(blank.blank_id)}, ${
        filled !== undefined ? blank.options[filled] : 'empty'
      }`,
      statusText,
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <span
        data-testid="blank-fill"
        data-blank-id={blank.blank_id}
        data-state={state}
        aria-label={label}
        className={cn(
          'mx-0.5 inline-block min-w-blank border-b-2 px-1 align-baseline transition-colors',
          verdictBlankClass[state],
        )}
      >
        <Text as="span" weight="semibold">
          {filled !== undefined ? blank.options[filled] : '\u00a0'}
        </Text>
        {state === 'correct' ? (
          <Check
            aria-hidden="true"
            className="ml-1 inline size-3.5 text-icon-success"
            strokeWidth={3}
          />
        ) : state === 'incorrect' ? (
          <Minus
            aria-hidden="true"
            className="ml-1 inline size-3.5 text-icon-danger"
            strokeWidth={3}
          />
        ) : null}
      </span>
    );
  }

  const spanKeyOccurrences = new Map<string, number>();
  const keyedSegments = segments.map((segment) => {
    if (segment.kind === 'blank') {
      return { key: `blank-${segment.blank_id}`, segment };
    }
    const contentKey = JSON.stringify(segment.spans);
    const occurrence = spanKeyOccurrences.get(contentKey) ?? 0;
    spanKeyOccurrences.set(contentKey, occurrence + 1);
    return { key: `span-${contentKey}-${occurrence}`, segment };
  });

  return (
    <OperationShell
      exercise={exercise}
      desktopExpanded
      canCheck={canCheck}
      attempt={
        allowRetry
          ? {
              kind: 'retry',
              phase,
              result,
              shakeKey,
              canReveal,
              onReveal: handleReveal,
            }
          : { kind: 'single', result }
      }
      instruction="Tap a word below to drop it into the blank. Tap another to swap it."
      onCheck={check}
      onContinue={finish}
      {...props}
    >
      <div className="radius-section border border-default bg-neutral-subtle p-4">
        <Text size="fluid" tone="default">
          {keyedSegments.map(({ key, segment }) => {
            if (segment.kind === 'span') {
              return <SpanView key={key} spans={segment.spans} />;
            }
            return (
              <span key={key} className="whitespace-nowrap">
                {renderSlot(segment)}
              </span>
            );
          })}
        </Text>
      </div>

      <div className="flex flex-col gap-3">
        {blanks.map((blank) => {
          const groupLabel =
            blanks.length > 1
              ? `Choose the correct form for blank ${blankNumber(blank.blank_id)}`
              : 'Choose the correct form';
          const activeIndex = activeByBlank[blank.blank_id] ?? 0;
          return (
            <div key={blank.blank_id} className="flex flex-col gap-2">
              <Heading as="div" size="xxsmall" tone="subtle">
                {groupLabel}
              </Heading>
              <div
                role="radiogroup"
                aria-label={groupLabel}
                className="inline-flex w-fit max-w-full flex-wrap gap-1.5"
              >
                {blank.options.map((optionText, optionIndex) => {
                  const selected = answers[blank.blank_id] === optionIndex;
                  const isAnswer = optionIndex === blank.answer_index;
                  const state = resolveAnswerOptionState({
                    checked: selected,
                    graded: isLocked,
                    isAnswer,
                  });
                  const isTabbable = !isLocked && activeIndex === optionIndex;
                  return (
                    <AnswerOption
                      key={optionIndex}
                      aria-label={optionText}
                      checked={selected}
                      disabled={isLocked}
                      label={optionText}
                      lang="no"
                      layout="inline"
                      onClick={() => selectOption(blank.blank_id, optionIndex)}
                      onKeyDown={(event) =>
                        handleRadioKeyDown(event, blank, optionIndex)
                      }
                      ref={(element) => {
                        const refs = (optionRefs.current[blank.blank_id] ??=
                          []);
                        refs[optionIndex] = element;
                      }}
                      state={state}
                      tabIndex={isTabbable ? 0 : -1}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </OperationShell>
  );
}
