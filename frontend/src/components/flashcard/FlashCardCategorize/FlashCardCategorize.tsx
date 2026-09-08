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
import { useState, type ReactNode } from 'react';

import { useCheckableExercise } from '@/hooks/flashcard/useCheckableExercise/useCheckableExercise';
import { gradedOutcome } from '@/lib/operationResult';
import type { Exercise } from '@/types/lesson-contracts';

import { DropZone } from '../DropZone/DropZone';
import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';
import {
  draggableTokenChipClassName,
  TokenChip,
  type TokenChipState,
} from '../TokenChip/TokenChip';

type CategorizeExercise = Extract<Exercise, { operation: 'categorize' }>;

/** Sentinel id for the "unassigned items" tray DropZone. */
const TRAY_ID = '__categorize-tray__';
interface DraggableChipProps {
  itemId: string;
  text: string;
  state: TokenChipState;
  isActiveDrag: boolean;
  disabled: boolean;
  onArm?: () => void;
}

/**
 * A single draggable item chip. dnd-kit's attributes/listeners are spread
 * onto the TokenChip so it speaks pointer / touch / keyboard out of the
 * box. A supplementary onClick arms the chip for tap-to-place — this does
 * not conflict with the drag listeners because the PointerSensor's
 * activation constraint (distance: 4) lets pure taps fall through.
 *
 * The onClick stops propagation so a chip click only arms the chip; the
 * surrounding DropZone's onClick is reserved for placing the armed chip.
 */
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
      className={draggableTokenChipClassName}
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
    check: checkExercise,
    reveal: revealExercise,
    markDirty,
  } = useCheckableExercise();

  // Snapshot of the learner's assignments at Reveal time. On reveal the
  // live `assignments` get rewritten to the correct mapping (so chips relocate
  // and reveal the answer), but coloring must still reflect what the learner
  // actually chose — so chip state is derived from this snapshot, not the
  // relocated `assignments`.
  const [checkedAssignments, setCheckedAssignments] = useState<Record<
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
    checkExercise(allCorrect);
  }

  function handleReveal() {
    // Snapshot the learner's assignments BEFORE relocation.
    setCheckedAssignments({ ...assignments });
    // Relocate chips to correct buckets.
    setAssignments(
      Object.fromEntries(items.map((item) => [item.item_id, item.bucket_id])),
    );
    const fraction = computeFraction();
    revealExercise(fraction);
  }

  function handleContinue() {
    if (result) {
      onFinished?.(gradedOutcome(result));
    }
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

  /** Shared assignment helper for both drag-end and tap-to-place. */
  function assignItem(itemId: string, zoneId: string) {
    if (zoneId === TRAY_ID) {
      setAssignments((curr) => ({ ...curr, [itemId]: null }));
    } else {
      setAssignments((curr) => ({ ...curr, [itemId]: zoneId }));
    }
    markDirty();
  }

  /** Tap-to-place: clicking an item arms it; clicking a zone assigns it. */
  function handleZoneClick(zoneId: string) {
    if (!armedItemId || isLocked) return;
    assignItem(armedItemId, zoneId);
    setArmedItemId(null);
  }

  function chipStateForItem(itemId: string): TokenChipState {
    if (armedItemId === itemId) return 'selected';
    if (!isRevealedOrSolved) return 'idle';
    const item = items.find((i) => i.item_id === itemId);
    // Colour from the learner's snapshot, not the (possibly relocated)
    // assignments — a chip the learner misplaced shows wrong even though it now
    // sits in its correct bucket.
    const chosen = checkedAssignments?.[itemId] ?? assignments[itemId];
    return chosen === item?.bucket_id ? 'correct' : 'wrong';
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
      result={result}
      canCheck={canCheck}
      retry={{ phase, shakeKey, canReveal, onReveal: handleReveal }}
      instruction="Drag each word into the right group — or tap a word, then tap its group."
      onCheck={check}
      onContinue={handleContinue}
      {...props}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Tray of unassigned items */}
        <div>
          <p className="type-caption mb-2 text-muted-foreground/80">
            {armedItemText
              ? `Now tap a group for ${armedItemText}.`
              : 'Tap a word, then tap its group — or drag it.'}
          </p>
          <p
            id="categorize-tray-label"
            className="type-label text-muted-foreground mb-2"
          >
            Items
          </p>
          <DropZone
            id={TRAY_ID}
            label="Items"
            tone="target"
            className="min-h-[3.25rem] border-2 border-primary-40/60 bg-primary-5/40 p-2"
          >
            {items
              .filter((item) => assignments[item.item_id] == null)
              .map((item) => renderChip(item.item_id, item.text))}
          </DropZone>
        </div>

        {/* Buckets */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {buckets.map((bucket) => (
            <div key={bucket.bucket_id} className="min-w-0 flex-1">
              <p
                id={`bucket-label-${bucket.bucket_id}`}
                className="type-label text-muted-foreground mb-2"
              >
                {bucket.label}
              </p>
              <p className="type-caption mb-2 text-muted-foreground/80">
                Drop here
              </p>
              <DropZone
                id={bucket.bucket_id}
                tone="target"
                aria-labelledby={`bucket-label-${bucket.bucket_id}`}
                onClick={() => handleZoneClick(bucket.bucket_id)}
                className="min-h-14 content-start border-2 border-primary-40/60 bg-primary-5/30 p-2 sm:min-h-[4.5rem]"
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
              className={draggableTokenChipClassName}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </OperationShell>
  );
}
