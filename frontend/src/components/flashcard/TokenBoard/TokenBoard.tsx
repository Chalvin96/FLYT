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
import { Text } from '@flyt/ui';
import { cva } from 'class-variance-authority';
import { LayoutGroup, m, useReducedMotion } from 'motion/react';
import { useMemo, type ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import type { ChoiceVerdict } from '../answerVerdict';
import { verdictDropTargetClass } from '../answerVerdict';
import { TokenChip, type TokenChipState } from '../TokenChip/TokenChip';

export interface TokenBoardToken {
  token_id: string;
  text: string;
  fixed: boolean;
}

const tokenBoardVariants = cva('flex flex-col gap-4');

export interface TokenBoardProps extends Omit<
  ComponentProps<'div'>,
  'className' | 'style' | 'onDrop'
> {
  /** All tokens (fixed + movable). */
  tokens: TokenBoardToken[];
  /** Full answer order including fixed tokens (defines the sentence layout). */
  answerOrder: string[];
  /** Optional display order for movable bank tokens. Defaults to source order. */
  bankTokenIds?: string[];
  /** One entry per movable slot, in sentence order; `null` is an empty slot. */
  selectedTokenIds: (string | null)[];
  /** Called when a bank chip is tapped (add to first open slot). */
  onAdd: (tokenId: string) => void;
  /** Called when a token is moved to a specific slot (handles swap/evict/move). */
  onMoveToSlot: (tokenId: string, slotIndex: number) => void;
  /** Called when a placed chip is tapped (remove from its slot). */
  onRemove: (slotIndex: number) => void;
  disabled?: boolean;
  /** The correct token id per movable slot; colors placed chips once `result` is set. */
  movableAnswerOrder?: string[];
  result?: { correct: boolean } | null;
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
  onClick?: () => void;
}

function DraggableBoardToken({
  tokenId,
  text,
  state,
  disabled,
  ariaLabel,
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
      grabbable
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
    <div
      ref={setNodeRef}
      aria-hidden="true"
      className={cn(
        'radius-field border border-dashed border-default bg-neutral-subtle px-4 py-3 text-subtle transition-colors',
        isOver && cn(verdictDropTargetClass, 'text-default'),
      )}
    >
      <Text as="div" size="large">
        ···
      </Text>
    </div>
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
  ...rootProps
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

  function placedChipState(slotIndex: number): ChoiceVerdict {
    if (!result || !movableAnswerOrder) return 'idle';
    const expected = movableAnswerOrder[slotIndex];
    const actual = selectedTokenIds[slotIndex];
    return actual === expected ? 'correct' : 'incorrect';
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
      if (placedIndex !== -1) {
        onRemove(placedIndex);
      }
      return;
    }

    if (overId === SENTENCE_DROP_ID) {
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
        <div
          {...rootProps}
          className={cn(tokenBoardVariants())}
          style={undefined}
        >
          <div
            ref={setSentenceRef}
            aria-label="Built sentence"
            className={cn(
              'flex min-h-24 min-w-0 flex-wrap items-center gap-2 radius-field border border-default bg-neutral p-3 transition-colors',
              isSentenceOver && verdictDropTargetClass,
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

          <div
            ref={setBankRef}
            data-testid="token-bank"
            className={cn(
              'flex min-w-0 flex-wrap gap-2 radius-field transition-colors',
              isBankOver && 'bg-selected',
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
