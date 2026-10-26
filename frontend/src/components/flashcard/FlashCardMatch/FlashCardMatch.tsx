import { Heading, Text } from '@flyt/ui';
import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useExerciseAttempt } from '@/hooks/flashcard/useExerciseAttempt/useExerciseAttempt';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types/lesson-contracts';

import {
  answerVerdictStatusText,
  verdictMatchTileClass,
  type MatchTileVerdict,
} from '../answerVerdict';
import { OperationShell } from '../OperationShell';
import type { OperationComponentProps } from '../operationTypes';

type MatchExercise = Extract<Exercise, { operation: 'match_pairs' }>;

interface MatchTile {
  runtimeKey: string;
  id: string;
  text: string;
  side: 'left' | 'right';
  pairIds: string[];
}

type TileVisual = MatchTileVerdict | 'target' | 'dimmed';

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pairKey(leftId: string, rightId: string): string {
  return JSON.stringify([leftId, rightId]);
}

const WRONG_FLASH_MS = 500;

const cardClassName =
  'radius-field min-h-14 w-full border-2 px-3 py-2.5 text-center whitespace-normal break-words flex items-center justify-center gap-1.5';

function tileClasses(v: TileVisual): string {
  switch (v) {
    case 'target':
      return 'border-brand-subtle bg-brand-subtle ring-2 ring-[var(--border-brand-subtle)] cursor-pointer';
    case 'dimmed':
      return 'border-default bg-raised text-default opacity-40 cursor-pointer';
    default:
      return verdictMatchTileClass[v];
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
  const isMatched = visual === 'correct';
  // The flashing tiles are disabled too: Enter on a red tile would otherwise
  // fire with no effect and no feedback.
  const isDisabled = isMatched || boardLocked;

  return (
    <button
      type="button"
      aria-label={
        isMatched
          ? `${tile.text}, ${answerVerdictStatusText.correct}`
          : visual === 'selected'
            ? `${tile.text}, ${answerVerdictStatusText.selected} — tap its match`
            : tile.text
      }
      aria-pressed={visual === 'selected'}
      data-state={visual}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        cardClassName,
        !reducedMotion && 'transition-[scale,box-shadow] duration-150',
        tileClasses(visual),
      )}
    >
      <span className="min-w-0 break-words">
        <Text as="span" size="large" weight="semibold">
          {tile.text}
        </Text>
      </span>
      {isMatched && (
        <span aria-hidden className="text-success">
          ✓
        </span>
      )}
    </button>
  );
}

export function FlashCardMatch({
  exercise,
  allowRetry,
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
        pairIds: pairs.reduce<string[]>((pairIds, pair) => {
          if (pair.left_id === item.left_id) {
            pairIds.push(pairKey(pair.left_id, pair.right_id));
          }
          return pairIds;
        }, []),
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
        pairIds: pairs.reduce<string[]>((pairIds, pair) => {
          if (pair.right_id === item.right_id) {
            pairIds.push(pairKey(pair.left_id, pair.right_id));
          }
          return pairIds;
        }, []),
      })),
    );
  });

  const [armedId, setArmedId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const [boardLocked, setBoardLocked] = useState(false);
  const { wrongCount, result, reportRight, reportWrong, finish } =
    useExerciseAttempt({
      allowRetry,
      commitGradesAtCompletion: true,
      initialResult: pairs.length === 0 ? { correct: true } : null,
      onFinished,
    });

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
    if (isTileLocked(tile)) return 'correct';
    if (flashingIds.has(tile.runtimeKey)) return 'wrong-flash';
    if (armedId === tile.runtimeKey) return 'selected';
    if (armedId !== null) {
      const armed = tileById.get(armedId)!;
      return armed.side === tile.side ? 'dimmed' : 'target';
    }
    return 'idle';
  }

  function handleTileTap(tile: MatchTile) {
    if (result || boardLocked || isTileLocked(tile)) return;

    if (armedId === tile.runtimeKey) {
      setArmedId(null);
      return;
    }

    if (armedId === null) {
      setArmedId(tile.runtimeKey);
      return;
    }

    const armedTile = tileById.get(armedId)!;

    if (armedTile.side === tile.side) {
      setArmedId(tile.runtimeKey);
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
        reportRight();
      }
    } else {
      setArmedId(null);
      reportWrong();
      setFlashingIds(new Set([armedTile.runtimeKey, tile.runtimeKey]));
      setBoardLocked(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        setFlashingIds(new Set());
        setBoardLocked(false);
      }, WRONG_FLASH_MS);
    }
  }

  return (
    <OperationShell
      exercise={exercise}
      desktopExpanded
      attempt={{ kind: 'single', result }}
      canCheck={false}
      statusHint={`${matchedPairs.size} / ${pairs.length} matched`}
      instruction="Tap an item on the left, then tap its match on the right."
      onCheck={() => {}}
      onContinue={finish}
      {...props}
    >
      {/* Keyed by wrongCount so every wrong tap re-announces the same text. */}
      {wrongCount > 0 && (
        <span key={wrongCount} role="alert" className="sr-only">
          {answerVerdictStatusText['wrong-flash']}
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
              boardLocked={boardLocked || Boolean(result)}
            />
          ))}
        </div>
        <div
          className="flex w-7 shrink-0 flex-col items-center sm:w-10"
          aria-hidden
        >
          <div className="w-px flex-1 bg-neutral-pressed" />
          <span className="my-1 rounded-full border border-default bg-raised px-1.5 py-0.5">
            <Heading as="span" size="xxsmall" tone="subtle">
              ↔
            </Heading>
          </span>
          <div className="w-px flex-1 bg-neutral-pressed" />
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
              boardLocked={boardLocked || Boolean(result)}
            />
          ))}
        </div>
      </div>
    </OperationShell>
  );
}
