import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  K_RATING_AGAIN,
  K_RATING_EASY,
  K_RATING_HARD,
} from '@/lib/fsrsRatings';
import { gradedOutcome } from '@/lib/operationResult';
import type { OperationResult } from '@/lib/operationResult';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type MatchExercise = Extract<Exercise, { operation: 'match_pairs' }>;

interface MatchTile {
  runtimeKey: string;
  id: string; // left_id or right_id
  text: string;
  side: 'left' | 'right';
  pairIds: string[];
}

type TileVisual =
  'idle' | 'armed' | 'target' | 'dimmed' | 'locked' | 'wrong-flash';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function computeRating(wrong: number): number {
  if (wrong === 0) return K_RATING_EASY;
  if (wrong <= 2) return K_RATING_HARD;
  return K_RATING_AGAIN;
}

function pairKey(leftId: string, rightId: string): string {
  return JSON.stringify([leftId, rightId]);
}

const cardClassName =
  'radius-field type-body min-h-14 w-full border-2 px-3 py-2.5 text-center whitespace-normal break-words flex items-center justify-center gap-1.5';

function tileClasses(v: TileVisual): string {
  switch (v) {
    case 'locked':
      return 'border-primary-20 bg-secondary-5 text-muted-foreground opacity-70 pointer-events-none';
    case 'armed':
      return 'border-primary-70 bg-primary-70 text-white-100 scale-[1.03] shadow-lift';
    case 'target':
      return 'border-primary-40 bg-primary-5 ring-2 ring-primary-30 cursor-pointer';
    case 'dimmed':
      return 'border-border bg-card text-foreground opacity-40 cursor-pointer';
    case 'wrong-flash':
      return 'border-destructive-20 bg-destructive-0 text-destructive-80';
    default:
      return 'border-border bg-card text-foreground hover:border-primary-30 hover:bg-primary-5 cursor-pointer';
  }
}

interface TileProps {
  tile: MatchTile;
  visual: TileVisual;
  onClick: () => void;
  boardLocked: boolean;
}

function MatchTileButton({ tile, visual, onClick, boardLocked }: TileProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const isLocked = visual === 'locked';
  // Disable every tile while the board is locked (the 500ms wrong-flash window),
  // including the flashing tiles themselves — otherwise a keyboard user can press
  // Enter on a red tile with no effect or feedback.
  const isDisabled = isLocked || boardLocked;

  return (
    <button
      type="button"
      aria-label={
        isLocked
          ? `${tile.text}, matched`
          : visual === 'armed'
            ? `${tile.text}, selected — tap its match`
            : tile.text
      }
      aria-pressed={visual === 'armed'}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        cardClassName,
        !reducedMotion && 'transition-all duration-150',
        tileClasses(visual),
      )}
    >
      <span className="min-w-0 break-words font-medium leading-snug">
        {tile.text}
      </span>
      {isLocked && (
        <span aria-hidden className="text-primary-60">
          ✓
        </span>
      )}
    </button>
  );
}

export function FlashCardMatch({
  exercise,
  onFinished,
  ...props
}: OperationComponentProps<MatchExercise>) {
  const { left, right, pairs } = exercise.payload;

  const [leftTiles] = useState<MatchTile[]>(() =>
    shuffleArray(
      left.map((item) => ({
        runtimeKey: `left:${item.left_id}`,
        id: item.left_id,
        text: item.text,
        side: 'left' as const,
        pairIds: pairs
          .filter((pair) => pair.left_id === item.left_id)
          .map((pair) => pairKey(pair.left_id, pair.right_id)),
      })),
    ),
  );

  const [rightTiles] = useState<MatchTile[]>(() => {
    return shuffleArray(
      right.map((item) => ({
        runtimeKey: `right:${item.right_id}`,
        id: item.right_id,
        text: item.text,
        side: 'right' as const,
        pairIds: pairs
          .filter((pair) => pair.right_id === item.right_id)
          .map((pair) => pairKey(pair.left_id, pair.right_id)),
      })),
    );
  });

  const [armedId, setArmedId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const [boardLocked, setBoardLocked] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  // A malformed payload with no pairs would render an empty board the learner
  // can never complete (tap is the only path to a result) — auto-resolve at init.
  const [result, setResult] = useState<OperationResult | null>(() =>
    pairs.length === 0 ? { correct: true, rating: K_RATING_EASY } : null,
  );

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const tileById = useMemo(
    () => new Map([...leftTiles, ...rightTiles].map((t) => [t.runtimeKey, t])),
    [leftTiles, rightTiles],
  );

  function isTileLocked(tile: MatchTile): boolean {
    return (
      tile.pairIds.length > 0 &&
      tile.pairIds.every((relation) => matchedPairs.has(relation))
    );
  }

  function tileVisual(tile: MatchTile): TileVisual {
    if (isTileLocked(tile)) return 'locked';
    if (flashingIds.has(tile.runtimeKey)) return 'wrong-flash';
    if (armedId === tile.runtimeKey) return 'armed';
    if (armedId !== null) {
      const armed = tileById.get(armedId)!;
      return armed.side === tile.side ? 'dimmed' : 'target';
    }
    return 'idle';
  }

  function handleTileTap(tile: MatchTile) {
    if (result || boardLocked || isTileLocked(tile)) return;

    if (armedId === tile.runtimeKey) {
      setArmedId(null); // disarm
      return;
    }

    if (armedId === null) {
      setArmedId(tile.runtimeKey); // arm
      return;
    }

    const armedTile = tileById.get(armedId)!;

    if (armedTile.side === tile.side) {
      setArmedId(tile.runtimeKey); // re-arm same column
      return;
    }

    const tilePairIds = new Set(tile.pairIds);
    const relation = armedTile.pairIds.find((pairId) =>
      tilePairIds.has(pairId),
    );
    if (relation) {
      const nextMatched = new Set(matchedPairs);
      nextMatched.add(relation);
      setMatchedPairs(nextMatched);
      setArmedId(null);
      if (nextMatched.size === pairs.length) {
        setResult({ correct: true, rating: computeRating(wrongCount) });
      }
    } else {
      // wrong
      setArmedId(null);
      setWrongCount((n) => n + 1);
      setFlashingIds(new Set([armedTile.runtimeKey, tile.runtimeKey]));
      setBoardLocked(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        setFlashingIds(new Set());
        setBoardLocked(false);
      }, 500);
    }
  }

  return (
    <OperationShell
      exercise={exercise}
      desktopExpanded
      result={result}
      canCheck={false}
      statusHint={`${matchedPairs.size} / ${pairs.length} matched`}
      instruction="Tap an item on the left, then tap its match on the right."
      onCheck={() => {}}
      onContinue={() => {
        if (result) onFinished?.(gradedOutcome(result));
      }}
      {...props}
    >
      {/* Screen-reader feedback for a wrong match — the red flash is otherwise
          the only signal. Keyed by wrongCount so each wrong tap re-announces. */}
      {wrongCount > 0 && (
        <span key={wrongCount} role="alert" className="sr-only">
          Not a match.
        </span>
      )}
      <div
        className="flex items-stretch gap-2 sm:gap-3"
        aria-label="Match pairs"
      >
        <div
          className="flex flex-1 flex-col gap-2 sm:gap-3"
          role="group"
          aria-label="Items"
        >
          {leftTiles.map((tile) => (
            <MatchTileButton
              key={tile.runtimeKey}
              tile={tile}
              visual={tileVisual(tile)}
              onClick={() => handleTileTap(tile)}
              boardLocked={boardLocked}
            />
          ))}
        </div>
        {/* center gutter: vertical line + "match" pill with <-> */}
        <div
          className="flex w-7 shrink-0 flex-col items-center sm:w-10"
          aria-hidden
        >
          <div className="w-px flex-1 bg-border" />
          <span className="type-label my-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-muted-foreground">
            ↔
          </span>
          <div className="w-px flex-1 bg-border" />
        </div>
        <div
          className="flex flex-1 flex-col gap-2 sm:gap-3"
          role="group"
          aria-label="Matches"
        >
          {rightTiles.map((tile) => (
            <MatchTileButton
              key={tile.runtimeKey}
              tile={tile}
              visual={tileVisual(tile)}
              onClick={() => handleTileTap(tile)}
              boardLocked={boardLocked}
            />
          ))}
        </div>
      </div>
    </OperationShell>
  );
}
