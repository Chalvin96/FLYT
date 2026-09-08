import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Exercise } from '@/types/lesson-contracts';

import { FlashCardBuild } from './FlashCardBuild';

type BuildExercise = Extract<Exercise, { operation: 'build' }>;

function buildExercise(): BuildExercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'build-1',
    operation: 'build',
    prompt: [{ kind: 'text', value: 'Build the sentence' }],
    explanation: null,
    payload: {
      tokens: [
        { token_id: 't1', text: 'Jeg', fixed: true },
        { token_id: 't2', text: 'spiser', fixed: false },
        { token_id: 't3', text: 'fisk', fixed: false },
        { token_id: 't4', text: 'i dag', fixed: true },
      ],
      answer_order: ['t1', 't2', 't3', 't4'],
    },
  };
}

/**
 * The no-op guards in FlashCardBuild (skip markDirty when the board doesn't
 * change) are not reachable through the normal dnd-kit / tap UI in jsdom:
 *  - handleAdd: bank buttons disappear once every slot is filled.
 *  - handleMoveToSlot: requires a real drag (dnd-kit zero-size rects in jsdom).
 *  - handleRemove: TokenBoard always passes a valid in-bounds index.
 *
 * To exercise the handlers directly we mock TokenBoard and capture the
 * callbacks the parent passes in.
 */
const mockProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock('../TokenBoard/TokenBoard', () => ({
  TokenBoard: (props: Record<string, unknown>) => {
    mockProps.current = props;
    return null;
  },
}));

describe('FlashCardBuild — no-op interactions do not bypass the dirty gate', () => {
  function fillBoardWrong() {
    // Movable slots: [null, null] → answer order is [t2, t3].
    // Place wrong: fisk (t3) first, spiser (t2) second.
    act(() => {
      (mockProps.current!.onAdd as (id: string) => void)('t3');
    });
    act(() => {
      (mockProps.current!.onAdd as (id: string) => void)('t2');
    });
  }

  function wrongCheck() {
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
  }

  it('a same-slot move after a wrong check keeps Check disabled', () => {
    render(<FlashCardBuild exercise={buildExercise()} />);

    fillBoardWrong();
    // Check enabled (board complete, phase working).
    expect(screen.getByRole('button', { name: /^check/i })).not.toBeDisabled();

    wrongCheck();
    // Dirty gate: Check disabled.
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();

    // t3 is at slot 0; moving it to slot 0 is a no-op.
    act(() => {
      (mockProps.current!.onMoveToSlot as (id: string, idx: number) => void)(
        't3',
        0,
      );
    });

    // Check stays disabled — markDirty was not called.
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();
  });

  it('handleAdd when all slots are full does not re-enable Check', () => {
    render(<FlashCardBuild exercise={buildExercise()} />);

    fillBoardWrong();
    wrongCheck();
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();

    // All slots are full → handleAdd is a no-op.
    act(() => {
      (mockProps.current!.onAdd as (id: string) => void)('t3');
    });

    // Check stays disabled.
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();
  });

  it('handleRemove with an out-of-bounds index does not re-enable Check', () => {
    render(<FlashCardBuild exercise={buildExercise()} />);

    fillBoardWrong();
    wrongCheck();
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();

    // Out-of-bounds index → handleRemove is a no-op.
    act(() => {
      (mockProps.current!.onRemove as (idx: number) => void)(99);
    });

    // Check stays disabled.
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();
  });

  it('handleRemove on an already-empty slot does not re-enable Check', () => {
    render(<FlashCardBuild exercise={buildExercise()} />);

    fillBoardWrong();
    // Slots: [t3, t2]. Check enabled (board complete, phase working).
    expect(screen.getByRole('button', { name: /^check/i })).not.toBeDisabled();

    wrongCheck();
    // Dirty gate: Check disabled.
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();

    // Slot 0 is occupied by t3; remove it (real change, now dirty + incomplete).
    act(() => {
      (mockProps.current!.onRemove as (idx: number) => void)(0);
    });
    // Slot 0 is now empty; removing it again is a no-op (already null).
    act(() => {
      (mockProps.current!.onRemove as (idx: number) => void)(0);
    });

    // Board is incomplete (1 of 2 filled). The first remove set dirty=true.
    // The second remove was a no-op and must not have changed anything.
    // Complete the board by placing t3 back: canCheck depends on dirty
    // being true (from the first remove), not on the no-op second remove.
    act(() => {
      (mockProps.current!.onAdd as (id: string) => void)('t3');
    });

    // Check re-enabled — dirty was set by the first remove.
    expect(screen.getByRole('button', { name: /^check/i })).not.toBeDisabled();
  });

  it('a real board change after a wrong check re-enables Check', () => {
    // Positive control: verify the gate DOES open on a real change.
    render(<FlashCardBuild exercise={buildExercise()} />);

    fillBoardWrong();
    wrongCheck();
    expect(screen.getByRole('button', { name: /^check/i })).toBeDisabled();

    // Remove t3 from slot 0 (real change).
    act(() => {
      (mockProps.current!.onRemove as (idx: number) => void)(0);
    });

    // Board is now incomplete (1 of 2 filled), but dirty=true so the gate
    // would open once the board is complete again.
    // Add t3 back to the first open slot.
    act(() => {
      (mockProps.current!.onAdd as (id: string) => void)('t3');
    });

    // Check re-enabled.
    expect(screen.getByRole('button', { name: /^check/i })).not.toBeDisabled();
  });
});
