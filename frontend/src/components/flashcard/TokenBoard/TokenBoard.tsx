import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { LayoutGroup, m, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { TokenChip, type TokenChipState } from '../TokenChip/TokenChip';

/**
 * TokenBoard
 *
 * Shared sentence-builder surface for Build (and reusable by Arrange
 * later). Renders two regions:
 *
 *  1. A **bank** of available TokenChips (movable tokens not yet placed).
 *  2. An **ordered slot row** — the sentence being built. Fixed tokens
 *     are pre-placed and locked; movable slots hold the user's selections
 *     or an empty placeholder.
 *
 * Positional model: `selectedTokenIds` is a fixed-length `(string | null)[]`
 * of length `movableSlotCount`. Each index maps directly to a movable slot
 * in the sentence. `null` means the slot is empty. This makes swap/eviction
 * operations straightforward: placed→placed swaps two indices, bank→filled
 * evicts the occupant (sets that index to the new token, old returns to
 * bank), and bank/placed→empty sets the target index and clears the source.
 *
 * Interaction supports both drag and tap-to-place: bank chips can be
 * dragged into the sentence (or tapped into the next open slot), and
 * placed chips can be dragged back to the bank (or tapped out). framer
 * `layoutId` continues to animate the bank↔sentence flight.
 *
 * Fully controlled: the parent owns `selectedTokenIds` and decides
 * placement via `onAdd` / `onMoveToSlot` / `onRemove`.
 */

export interface TokenBoardToken {
  token_id: string;
  text: string;
  fixed: boolean;
}

export interface TokenBoardProps {
  /** All tokens (fixed + movable). */
  tokens: TokenBoardToken[];
  /** Full answer order including fixed tokens (defines the sentence layout). */
  answerOrder: string[];
  /** Optional display order for movable bank tokens. Defaults to source order. */
  bankTokenIds?: string[];
  /**
   * Currently placed movable token IDs as a fixed-length positional array.
   * `null` = empty slot. Length must equal `movableSlotCount`.
   */
  selectedTokenIds: (string | null)[];
  /** Called when a bank chip is tapped (add to first open slot). */
  onAdd: (tokenId: string) => void;
  /** Called when a token is moved to a specific slot (handles swap/evict/move). */
  onMoveToSlot: (tokenId: string, slotIndex: number) => void;
  /** Called when a placed chip is tapped (remove from its slot). */
  onRemove: (slotIndex: number) => void;
  /** Disable all interaction (e.g. after Check). */
  disabled?: boolean;
  /**
   * When `result` is set, placed movable chips are colored per-slot.
   * `movableAnswerOrder[i]` is the correct token_id for movable slot i.
   */
  movableAnswerOrder?: string[];
  result?: { correct: boolean } | null;
  className?: string;
}

type Slot =
  | { kind: 'fixed'; tokenId: string; text: string }
  | {
      kind: 'movable';
      slotIndex: number;
      tokenId: string | null;
      text: string | null;
    };

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 32 };
const BANK_DROP_ID = 'token-board-bank';
const SENTENCE_DROP_ID = 'token-board-sentence';

interface DraggableBoardTokenProps {
  tokenId: string;
  text: string;
  state: TokenChipState;
  disabled: boolean;
  ariaLabel?: string;
  className?: string;
  onClick?: () => void;
}

function DraggableBoardToken({
  tokenId,
  text,
  state,
  disabled,
  ariaLabel,
  className,
  onClick,
}: DraggableBoardTokenProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tokenId,
    disabled,
  });

  return (
    <TokenChip
      ref={setNodeRef}
      text={text}
      state={isDragging ? 'dragging' : state}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      onClick={onClick}
      {...attributes}
      {...listeners}
    />
  );
}

function EmptySlot({ slotIndex }: { slotIndex: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `token-board-slot-${slotIndex}`,
  });

  return (
    <span
      ref={setNodeRef}
      aria-hidden="true"
      className={cn(
        'radius-field type-body border border-dashed border-border px-4 py-3 text-muted-foreground tint-target transition-colors',
        isOver && 'border-primary-60 bg-primary-5 text-foreground',
      )}
    >
      ···
    </span>
  );
}

export function TokenBoard({
  tokens,
  answerOrder,
  bankTokenIds,
  selectedTokenIds,
  onAdd,
  onMoveToSlot,
  onRemove,
  disabled = false,
  movableAnswerOrder,
  result,
  className,
}: TokenBoardProps) {
  const shouldReduceMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
  );
  const tokensById = useMemo(
    () => new Map(tokens.map((t) => [t.token_id, t])),
    [tokens],
  );

  // Derive the sentence layout: walk answerOrder; fixed tokens are
  // pre-placed, movable slots read directly from the positional array.
  const slots = useMemo<Slot[]>(() => {
    let movableIndex = 0;
    const nextSlots: Slot[] = [];
    for (const tokenId of answerOrder) {
      const token = tokensById.get(tokenId);
      if (!token) continue;
      if (token.fixed) {
        nextSlots.push({ kind: 'fixed', tokenId, text: token.text });
        continue;
      }
      const slotIndex = movableIndex++;
      const placedId = selectedTokenIds[slotIndex] ?? null;
      const placed = placedId ? tokensById.get(placedId) : null;
      nextSlots.push({
        kind: 'movable',
        slotIndex,
        tokenId: placedId,
        text: placed?.text ?? null,
      });
    }
    return nextSlots;
  }, [answerOrder, selectedTokenIds, tokensById]);

  const bankOrder = bankTokenIds ?? tokens.map((token) => token.token_id);
  const selectedTokenIdSet = new Set(selectedTokenIds);
  const availableTokens = bankOrder.reduce<TokenBoardToken[]>(
    (tokens, tokenId) => {
      const token = tokensById.get(tokenId);
      if (token && !token.fixed && !selectedTokenIdSet.has(token.token_id)) {
        tokens.push(token);
      }
      return tokens;
    },
    [],
  );
  const { setNodeRef: setBankRef, isOver: isBankOver } = useDroppable({
    id: BANK_DROP_ID,
  });
  const { setNodeRef: setSentenceRef, isOver: isSentenceOver } = useDroppable({
    id: SENTENCE_DROP_ID,
  });

  function placedChipState(slotIndex: number): TokenChipState {
    if (!result || !movableAnswerOrder) return 'idle';
    const expected = movableAnswerOrder[slotIndex];
    const actual = selectedTokenIds[slotIndex];
    return actual === expected ? 'correct' : 'wrong';
  }

  function firstOpenSlotIndex(): number | null {
    const idx = selectedTokenIds.indexOf(null);
    return idx !== -1 ? idx : null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const tokenId = String(active.id);
    const overId = String(over.id);
    const placedIndex = selectedTokenIds.indexOf(tokenId);

    if (overId === BANK_DROP_ID) {
      // Drop on bank: clear the source slot (back to bank).
      if (placedIndex !== -1) {
        onRemove(placedIndex);
      }
      return;
    }

    if (overId === SENTENCE_DROP_ID) {
      // Drop on the sentence region: fill the first open slot.
      const slotIndex = firstOpenSlotIndex();
      if (slotIndex !== null) {
        onMoveToSlot(tokenId, slotIndex);
      }
      return;
    }

    if (overId.startsWith('token-board-slot-')) {
      const slotIndex = Number(overId.replace('token-board-slot-', ''));
      if (!Number.isNaN(slotIndex)) {
        onMoveToSlot(tokenId, slotIndex);
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <LayoutGroup id="token-board">
        <div className={cn('flex flex-col gap-4', className)}>
          {/* Sentence row */}
          <div
            ref={setSentenceRef}
            aria-label="Built sentence"
            className={cn(
              'flex min-h-24 min-w-0 flex-wrap items-center gap-2 radius-field border border-border bg-background p-3 transition-colors',
              isSentenceOver && 'border-primary-60 bg-primary-5',
            )}
          >
            {slots.map((slot) => {
              if (slot.kind === 'fixed') {
                return (
                  <TokenChip
                    key={`fixed-${slot.tokenId}`}
                    text={slot.text}
                    state="fixed"
                  />
                );
              }

              if (slot.tokenId) {
                return (
                  <m.div
                    key={slot.tokenId}
                    layoutId={shouldReduceMotion ? undefined : slot.tokenId}
                    layout={!shouldReduceMotion}
                    transition={shouldReduceMotion ? { duration: 0 } : SPRING}
                  >
                    <DraggableBoardToken
                      tokenId={slot.tokenId}
                      text={slot.text ?? ''}
                      state={placedChipState(slot.slotIndex)}
                      disabled={disabled}
                      className="cursor-pointer"
                      ariaLabel={disabled ? undefined : `Remove ${slot.text}`}
                      onClick={
                        disabled ? undefined : () => onRemove(slot.slotIndex)
                      }
                    />
                  </m.div>
                );
              }

              return (
                <EmptySlot
                  key={`empty-${slot.slotIndex}`}
                  slotIndex={slot.slotIndex}
                />
              );
            })}
          </div>

          {/* Bank row */}
          <div
            ref={setBankRef}
            data-testid="token-bank"
            className={cn(
              'flex min-w-0 flex-wrap gap-2 rounded-field transition-colors',
              isBankOver && 'bg-primary-5',
            )}
          >
            {availableTokens.map((token) => (
              <m.div
                key={token.token_id}
                layoutId={shouldReduceMotion ? undefined : token.token_id}
                layout={!shouldReduceMotion}
                initial={
                  !shouldReduceMotion ? { opacity: 0, scale: 0.8 } : false
                }
                animate={{ opacity: 1, scale: 1 }}
                transition={shouldReduceMotion ? { duration: 0 } : SPRING}
              >
                <DraggableBoardToken
                  tokenId={token.token_id}
                  text={token.text}
                  state="idle"
                  disabled={disabled}
                  className="cursor-pointer"
                  ariaLabel={disabled ? undefined : `Add ${token.text}`}
                  onClick={disabled ? undefined : () => onAdd(token.token_id)}
                />
              </m.div>
            ))}
          </div>
        </div>
      </LayoutGroup>
    </DndContext>
  );
}

TokenBoard.displayName = 'TokenBoard';
