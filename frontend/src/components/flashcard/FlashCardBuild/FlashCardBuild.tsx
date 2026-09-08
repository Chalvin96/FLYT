import { useMemo, useState } from 'react';

import { useCheckableExercise } from '@/hooks/flashcard/useCheckableExercise/useCheckableExercise';
import { gradedOutcome } from '@/lib/operationResult';
import type { Exercise } from '@/types/lesson-contracts';

import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';
import { TokenBoard } from '../TokenBoard/TokenBoard';

type BuildExercise = Extract<Exercise, { operation: 'build' }>;

function shuffledMovableTokenIds(
  tokenIds: string[],
  answerOrder: string[],
): string[] {
  if (tokenIds.length <= 1) {
    return tokenIds;
  }

  const shuffled = [...tokenIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  if (shuffled.join('\u0000') === answerOrder.join('\u0000')) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

export function FlashCardBuild({
  exercise,
  onFinished,
  ...props
}: OperationComponentProps<BuildExercise>) {
  const { tokens, answer_order } = exercise.payload;

  const tokensById = useMemo(
    () => new Map(tokens.map((token) => [token.token_id, token])),
    [tokens],
  );
  const movableAnswerOrder = useMemo(
    () => answer_order.filter((tokenId) => !tokensById.get(tokenId)?.fixed),
    [answer_order, tokensById],
  );
  const [bankTokenIds] = useState(() =>
    shuffledMovableTokenIds(
      tokens.filter((token) => !token.fixed).map((token) => token.token_id),
      movableAnswerOrder,
    ),
  );

  // Positional model: fixed-length (string | null)[] of length movableSlotCount.
  const [selectedTokenIds, setSelectedTokenIds] = useState<(string | null)[]>(
    () => movableAnswerOrder.map(() => null),
  );

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

  const isLocked = isRevealedOrSolved;

  const filledCount = selectedTokenIds.filter(Boolean).length;
  const canCheck =
    filledCount === movableAnswerOrder.length && (phase !== 'wrong' || dirty);

  function check() {
    let allCorrect = true;
    for (let i = 0; i < movableAnswerOrder.length; i += 1) {
      if (selectedTokenIds[i] !== movableAnswerOrder[i]) {
        allCorrect = false;
        break;
      }
    }
    checkExercise(allCorrect);
  }

  function handleReveal() {
    let correctCount = 0;
    for (let i = 0; i < movableAnswerOrder.length; i += 1) {
      if (selectedTokenIds[i] === movableAnswerOrder[i]) {
        correctCount += 1;
      }
    }
    const fraction =
      movableAnswerOrder.length === 0
        ? 0
        : correctCount / movableAnswerOrder.length;
    // Set the full correct positional order.
    setSelectedTokenIds([...movableAnswerOrder]);
    revealExercise(fraction);
  }

  function handleContinue() {
    if (result) {
      onFinished?.(gradedOutcome(result));
    }
  }

  /** Add a bank token to the first open slot. */
  function handleAdd(tokenId: string) {
    // Synchronous no-op guard: skip markDirty when every slot is already
    // filled so the dirty gate isn't bypassed by a re-check with an
    // unchanged board. (We check the render state directly because React
    // defers functional-updater execution, so a `changed` flag inside the
    // updater would not be observable here.)
    if (selectedTokenIds.indexOf(null) === -1) return;
    setSelectedTokenIds((current) => {
      const openIdx = current.indexOf(null);
      if (openIdx === -1) return current;
      const next = [...current];
      next[openIdx] = tokenId;
      return next;
    });
    markDirty();
  }

  /**
   * Move a token to a specific slot. Handles three cases:
   * - placed→placed slot: SWAP the two indices.
   * - bank→filled slot: place token at index, evict old occupant (becomes
   *   null → returns to bank automatically).
   * - bank/placed→empty slot: set that index, clear source if it was placed.
   */
  function handleMoveToSlot(tokenId: string, slotIndex: number) {
    // Synchronous no-op guards from current render state: skip markDirty
    // when the board won't change. We detect the no-op here (rather than
    // via a `changed` flag inside the functional updater) because React
    // defers updater execution, so the flag would not be set yet when we
    // check it. The functional updater below still re-checks defensively
    // against its own `current` for correctness under batching.
    if (slotIndex < 0 || slotIndex >= selectedTokenIds.length) return;
    if (selectedTokenIds.indexOf(tokenId) === slotIndex) return;
    setSelectedTokenIds((current) => {
      if (slotIndex < 0 || slotIndex >= current.length) {
        return current;
      }
      const sourceIdx = current.indexOf(tokenId);
      if (sourceIdx === slotIndex) {
        return current;
      }

      const next = [...current];
      const occupant = next[slotIndex];

      if (sourceIdx !== -1) {
        // Source is a placed slot: SWAP with the target.
        next[sourceIdx] = occupant;
        next[slotIndex] = tokenId;
      } else {
        // Source is the bank: place at target. If the target was
        // occupied, the occupant goes back to bank (null).
        next[slotIndex] = tokenId;
      }
      return next;
    });
    markDirty();
  }

  /** Remove a placed token from its slot (set to null → returns to bank). */
  function handleRemove(slotIndex: number) {
    // Synchronous no-op guards: skip markDirty when the index is out of
    // range or the slot is already empty. (As with the other handlers, we
    // check the render state directly because React defers functional
    // updater execution, making an in-updater `changed` flag unobservable.)
    if (slotIndex < 0 || slotIndex >= selectedTokenIds.length) return;
    if (selectedTokenIds[slotIndex] === null) return;
    setSelectedTokenIds((current) => {
      if (slotIndex < 0 || slotIndex >= current.length) {
        return current;
      }
      const next = [...current];
      next[slotIndex] = null;
      return next;
    });
    markDirty();
  }

  return (
    <OperationShell
      exercise={exercise}
      desktopExpanded
      result={result}
      canCheck={canCheck}
      retry={{ phase, shakeKey, canReveal, onReveal: handleReveal }}
      instruction="Tap the words in order to build the sentence. Tap a placed word to send it back."
      onCheck={check}
      onContinue={handleContinue}
      {...props}
    >
      <TokenBoard
        tokens={tokens}
        answerOrder={answer_order}
        bankTokenIds={bankTokenIds}
        selectedTokenIds={selectedTokenIds}
        movableAnswerOrder={movableAnswerOrder}
        result={isRevealedOrSolved ? result : null}
        disabled={isLocked}
        onAdd={handleAdd}
        onMoveToSlot={handleMoveToSlot}
        onRemove={handleRemove}
      />
    </OperationShell>
  );
}
