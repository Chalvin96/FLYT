import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Text } from '@flyt/ui';
import { useState, type ReactNode } from 'react';

import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import { sentenceCaseLabel } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { DropZone } from '../DropZone/DropZone';
import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';
import { TokenChip, type TokenChipState } from '../TokenChip/TokenChip';

type CategorizeExercise = Extract<Exercise, { operation: 'categorize' }>;

const TRAY_ID = '__categorize-tray__';
interface DraggableChipProps {
  itemId: string;
  text: string;
  state: TokenChipState;
  isActiveDrag: boolean;
  disabled: boolean;
  onArm?: () => void;
}

// A pure tap falls through dnd-kit's PointerSensor distance constraint, so the
// drag listeners and this onClick coexist.
function DraggableChip({
  itemId,
  text,
  state,
  isActiveDrag,
  disabled,
  onArm,
}: DraggableChipProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: itemId,
    disabled,
  });

  return (
    <TokenChip
      ref={setNodeRef}
      text={text}
      state={isActiveDrag ? 'dragging' : state}
      disabled={disabled}
      aria-label={text}
      grabbable
      onClick={
        onArm
          ? (event) => {
              event.stopPropagation();
              onArm();
            }
          : undefined
      }
      {...attributes}
      {...listeners}
    />
  );
}

export function FlashCardCategorize({
  exercise,
  allowRetry,
  onFinished,
  ...props
}: OperationComponentProps<CategorizeExercise>) {
  const { buckets, items } = exercise.payload;
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    () => Object.fromEntries(items.map((item) => [item.item_id, null])),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [armedItemId, setArmedItemId] = useState<string | null>(null);

  const {
    phase,
    result,
    dirty,
    canReveal,
    isRevealedOrSolved,
    shakeKey,
    reportRight,
    reportWrong,
    reveal,
    markDirty,
    finish,
  } = useExerciseAttempt({ allowRetry, onFinished });

  const [assignmentsAtReveal, setAssignmentsAtReveal] = useState<Record<
    string,
    string | null
  > | null>(null);
  const isLocked = isRevealedOrSolved;

  const canCheck =
    items.every((item) => assignments[item.item_id] != null) &&
    (phase !== 'wrong' || dirty);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
  );

  function computeFraction(): number {
    if (items.length === 0) return 0;
    const correct = items.filter(
      (item) => assignments[item.item_id] === item.bucket_id,
    ).length;
    return correct / items.length;
  }

  function check() {
    const allCorrect = items.every(
      (item) => assignments[item.item_id] === item.bucket_id,
    );
    if (allCorrect) {
      reportRight();
    } else {
      reportWrong();
    }
  }

  function handleReveal() {
    setAssignmentsAtReveal({ ...assignments });
    setAssignments(
      Object.fromEntries(items.map((item) => [item.item_id, item.bucket_id])),
    );
    const fraction = computeFraction();
    reveal(fraction);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    assignItem(String(active.id), String(over.id));
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function assignItem(itemId: string, zoneId: string) {
    if (zoneId === TRAY_ID) {
      setAssignments((curr) => ({ ...curr, [itemId]: null }));
    } else {
      setAssignments((curr) => ({ ...curr, [itemId]: zoneId }));
    }
    markDirty();
  }

  function handleZoneClick(zoneId: string) {
    if (!armedItemId || isLocked) return;
    assignItem(armedItemId, zoneId);
    setArmedItemId(null);
  }

  function chipStateForItem(itemId: string): TokenChipState {
    if (armedItemId === itemId) return 'selected';
    if (!isRevealedOrSolved) return 'idle';
    const item = items.find((i) => i.item_id === itemId);
    const learnerBucketId = assignmentsAtReveal
      ? assignmentsAtReveal[itemId]
      : assignments[itemId];
    return learnerBucketId === item?.bucket_id ? 'correct' : 'incorrect';
  }

  const armedItemText = items.find(
    (item) => item.item_id === armedItemId,
  )?.text;
  const activeItemText = items.find((item) => item.item_id === activeId)?.text;

  function renderChip(itemId: string, text: string) {
    return (
      <DraggableChip
        key={itemId}
        itemId={itemId}
        text={text}
        state={chipStateForItem(itemId)}
        isActiveDrag={activeId === itemId}
        disabled={isLocked}
        onArm={
          isLocked
            ? undefined
            : () => {
                if (armedItemId === itemId && assignments[itemId] != null) {
                  assignItem(itemId, TRAY_ID);
                  setArmedItemId(null);
                  return;
                }
                setArmedItemId((curr) => (curr === itemId ? null : itemId));
              }
        }
      />
    );
  }

  return (
    <OperationShell
      exercise={exercise}
      canCheck={canCheck}
      attempt={{
        kind: 'retry',
        phase,
        result,
        shakeKey,
        canReveal,
        onReveal: handleReveal,
      }}
      instruction="Drag each word into the right group — or tap a word, then tap its group."
      onCheck={check}
      onContinue={finish}
      {...props}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div>
          <div className="mb-2 text-subtle/80">
            <Text size="medium">
              {armedItemText
                ? `Now tap a group for ${armedItemText}.`
                : 'Tap a word, then tap its group — or drag it.'}
            </Text>
          </div>
          <div className="mb-2">
            <Text id="categorize-tray-label" role="eyebrow" tone="subtle">
              Items
            </Text>
          </div>
          <DropZone
            id={TRAY_ID}
            label="Items"
            tone="target"
            className="min-h-[3.25rem] border-2 border-brand-subtle/60 p-2"
          >
            {items
              .filter((item) => assignments[item.item_id] == null)
              .map((item) => renderChip(item.item_id, item.text))}
          </DropZone>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {buckets.map((bucket) => (
            <div key={bucket.bucket_id} className="min-w-0 flex-1">
              <div className="mb-2">
                <Text
                  id={`bucket-label-${bucket.bucket_id}`}
                  role="eyebrow"
                  tone="subtle"
                >
                  {sentenceCaseLabel(bucket.label)}
                </Text>
              </div>
              <div className="mb-2 text-subtle/80">
                <Text size="medium">Drop here</Text>
              </div>
              <DropZone
                id={bucket.bucket_id}
                tone="target"
                aria-labelledby={`bucket-label-${bucket.bucket_id}`}
                onClick={() => handleZoneClick(bucket.bucket_id)}
                className="min-h-14 content-start border-2 border-brand-subtle/60 p-2 sm:min-h-[4.5rem]"
              >
                {items.reduce<ReactNode[]>((chips, item) => {
                  if (assignments[item.item_id] === bucket.bucket_id) {
                    chips.push(renderChip(item.item_id, item.text));
                  }
                  return chips;
                }, [])}
              </DropZone>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeId && activeItemText ? (
            <TokenChip
              text={activeItemText}
              state="dragging"
              aria-label={activeItemText}
              grabbable
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </OperationShell>
  );
}
