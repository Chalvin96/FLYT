import { useRef, useState } from 'react';

import { Button } from '@/components/common/Button/Button';
import { SpanView } from '@/components/portable/SpanView';
import { useCheckableExercise } from '@/hooks/flashcard/useCheckableExercise/useCheckableExercise';
import { gradedOutcome } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { ExerciseModeProvider } from '../ExerciseModeProvider';
import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type RecallFillExercise = Extract<Exercise, { operation: 'recall_fill' }>;

type BlankSegment = Extract<
  RecallFillExercise['payload']['segments'][number],
  { kind: 'blank' }
>;

type FillState = 'empty' | 'filled' | 'correct' | 'wrong';

/**
 * recall_fill is a "choose the correct form" drill, NOT a free-recall typed
 * blank and NOT a generic multiple-choice. The real data feeds a single slot
 * with a minimal pair of near-identical inflections (e.g. `stor` / `stort`,
 * `leser` / `leste`). The learner's job is to discriminate the right form for
 * that slot, in context.
 *
 * The UI leads with the sentence as the hero on the warm mat. The blank is an
 * inline underline that fills LIVE when a form is picked — the learner reads
 * the whole completed sentence ("Huset er stort"), which is the thing plain
 * Choose cannot do. The forms sit in a compact, tactile choice strip directly
 * under the sentence: warm chips on the mat, no outer card. One tap fills the
 * slot; tapping another form swaps it. No drag, no token bank.
 */
const FILL_CLASSES: Record<FillState, string> = {
  empty: 'border-dashed border-secondary-40 text-secondary-50',
  filled: 'border-primary-60 text-primary-90',
  correct: 'border-accent-60 text-accent-90',
  wrong: 'border-destructive-60 text-destructive-90',
};

const OPTION_BASE =
  'type-body h-10 rounded-full border-2 px-4 font-semibold transition-[background-color,border-color,box-shadow,color,transform] hover:-translate-y-0.5';
const OPTION_UNSELECTED =
  'border-secondary-20 bg-secondary-10 text-secondary-90 shadow-none hover:bg-secondary-20 hover:border-secondary-40 hover:shadow-tile';
const OPTION_SELECTED =
  'tint-selected ring-selected ring-2 ring-offset-2 ring-offset-background';
const OPTION_CORRECT = 'tint-judge-correct text-accent-90';
const OPTION_WRONG = 'tint-judge-wrong text-destructive-90';

export function FlashCardRecallFill(
  props: OperationComponentProps<RecallFillExercise>,
) {
  return (
    <ExerciseModeProvider allowRetry={false}>
      <FlashCardRecallFillOneShot {...props} />
    </ExerciseModeProvider>
  );
}

function FlashCardRecallFillOneShot({
  exercise,
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
  const { result, check: checkExercise } = useCheckableExercise();
  const isLocked = Boolean(result);

  const canCheck = blanks.every((b) => answers[b.blank_id] !== undefined);

  function check() {
    checkExercise(blanks.every((b) => answers[b.blank_id] === b.answer_index));
  }

  function handleContinue() {
    if (result) {
      onFinished?.(gradedOutcome(result));
    }
  }

  function selectOption(blankId: string, optionIndex: number) {
    if (isLocked) return;
    setAnswers((curr) => ({ ...curr, [blankId]: optionIndex }));
    setActiveByBlank((curr) => ({ ...curr, [blankId]: optionIndex }));
  }

  function blankNumber(blankId: string): number {
    return blanks.findIndex((b) => b.blank_id === blankId) + 1;
  }

  function fillState(blank: BlankSegment): FillState {
    const filled = answers[blank.blank_id];
    if (filled === undefined) return 'empty';
    if (!result) return 'filled';
    return filled === blank.answer_index ? 'correct' : 'wrong';
  }

  function moveActive(blank: BlankSegment, nextIndex: number) {
    const length = blank.options.length;
    const normalized = (nextIndex + length) % length;
    setActiveByBlank((curr) => ({ ...curr, [blank.blank_id]: normalized }));
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

  /**
   * Inline slot rendered inside the sentence for a blank. Reads as an
   * underline in the sentence typography, not a boxed field: empty = dashed
   * warm underline; filled = solid colored underline + the chosen form.
   * Correct/wrong recolor the underline + text after Check.
   */
  function renderSlot(blank: BlankSegment) {
    const filled = answers[blank.blank_id];
    const state = fillState(blank);
    const label =
      filled !== undefined
        ? `Blank ${blankNumber(blank.blank_id)}, ${blank.options[filled]}`
        : `Blank ${blankNumber(blank.blank_id)}, empty`;
    return (
      <span
        data-testid="blank-fill"
        data-blank-id={blank.blank_id}
        data-state={state}
        aria-label={label}
        className={cn(
          'mx-0.5 inline-block min-w-blank border-b-2 px-1 align-baseline font-semibold transition-colors',
          FILL_CLASSES[state],
        )}
      >
        {filled !== undefined ? blank.options[filled] : '\u00a0'}
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
      bodyClassName="bg-transparent"
      desktopExpanded
      result={result}
      canCheck={canCheck}
      instruction="Tap a word below to drop it into the blank. Tap another to swap it."
      onCheck={check}
      onContinue={handleContinue}
      {...props}
    >
      {/* The sentence is the hero; the blank fills live as a form is picked. */}
      <div className="radius-section border border-border bg-secondary-5 p-4">
        <p className="text-prompt leading-roomy text-foreground">
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
        </p>
      </div>

      {/*
        Compact, sentence-led choice strip per blank. Pills sit directly on
        the mat — no outer card. Warm unselected chips, primary selected,
        warm-green correct, coral wrong.
      */}
      <div className="flex flex-col gap-3">
        {blanks.map((blank) => {
          const groupLabel =
            blanks.length > 1
              ? `Choose the correct form for blank ${blankNumber(blank.blank_id)}`
              : 'Choose the correct form';
          const activeIndex = activeByBlank[blank.blank_id] ?? 0;
          return (
            <div key={blank.blank_id} className="flex flex-col gap-2">
              <p className="type-label text-muted-foreground">{groupLabel}</p>
              <div
                role="radiogroup"
                aria-label={groupLabel}
                className="inline-flex w-fit max-w-full flex-wrap gap-1.5"
              >
                {blank.options.map((optionText, optionIndex) => {
                  const selected = answers[blank.blank_id] === optionIndex;
                  const isCorrect =
                    result && optionIndex === blank.answer_index;
                  const isWrong = result && selected && !isCorrect;
                  const isTabbable =
                    !result && (selected || activeIndex === optionIndex);
                  return (
                    <Button
                      key={optionIndex}
                      ref={(element) => {
                        const arr = (optionRefs.current[blank.blank_id] ??= []);
                        arr[optionIndex] = element;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-checked={selected}
                      aria-label={optionText}
                      tabIndex={result ? -1 : isTabbable ? 0 : -1}
                      disabled={isLocked}
                      variant="outline"
                      lang="no"
                      className={cn(
                        OPTION_BASE,
                        !selected &&
                          !isCorrect &&
                          !isWrong &&
                          OPTION_UNSELECTED,
                        selected && !result && OPTION_SELECTED,
                        isCorrect && OPTION_CORRECT,
                        isWrong && OPTION_WRONG,
                      )}
                      onClick={() => selectOption(blank.blank_id, optionIndex)}
                      onKeyDown={(event) =>
                        handleRadioKeyDown(event, blank, optionIndex)
                      }
                    >
                      {optionText}
                    </Button>
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
