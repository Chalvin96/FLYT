import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';

import { ExerciseModeProvider } from '@/components/flashcard/ExerciseModeProvider';

import { useCheckableExercise } from './useCheckableExercise';

/** renderHook wrapper that supplies the ExerciseModeContext value. */
function withMode(allowRetry: boolean) {
  return ({ children }: { children: ReactNode }) => (
    <ExerciseModeProvider allowRetry={allowRetry}>
      {children}
    </ExerciseModeProvider>
  );
}

describe('useCheckableExercise', () => {
  describe('initial state', () => {
    it('starts in the working phase with no attempts and no result', () => {
      const { result } = renderHook(() => useCheckableExercise());

      expect(result.current.phase).toBe('working');
      expect(result.current.attempts).toBe(0);
      expect(result.current.result).toBeNull();
      expect(result.current.dirty).toBe(false);
      expect(result.current.canReveal).toBe(false);
      expect(result.current.isRevealedOrSolved).toBe(false);
      expect(result.current.shakeKey).toBe(0);
    });
  });

  describe('check', () => {
    it('transitions to solved with Easy (4) on a first-try correct check', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(true));

      expect(result.current.phase).toBe('solved');
      expect(result.current.attempts).toBe(0);
      expect(result.current.result).toEqual({ correct: true, rating: 4 });
      expect(result.current.isRevealedOrSolved).toBe(true);
    });

    it('transitions to solved with Hard (2) after at least one wrong check', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(false));
      expect(result.current.phase).toBe('wrong');
      expect(result.current.attempts).toBe(1);
      expect(result.current.result).toBeNull();

      // Simulate a board change before retrying.
      act(() => result.current.markDirty());
      act(() => result.current.check(true));

      expect(result.current.phase).toBe('solved');
      expect(result.current.attempts).toBe(1);
      expect(result.current.result).toEqual({ correct: true, rating: 2 });
    });

    it('increments attempts on a wrong check and clears dirty', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.markDirty());
      act(() => result.current.check(false));

      expect(result.current.attempts).toBe(1);
      expect(result.current.dirty).toBe(false);
      expect(result.current.result).toBeNull();
      expect(result.current.canReveal).toBe(true);
    });

    it('is a no-op when already in a terminal (solved) phase', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(true));
      act(() => result.current.check(false));

      expect(result.current.phase).toBe('solved');
      expect(result.current.attempts).toBe(0);
      expect(result.current.result).toEqual({ correct: true, rating: 4 });
    });

    it('is a no-op when already in a terminal (revealed) phase', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(false));
      act(() => result.current.reveal(0.4));
      act(() => result.current.check(true));

      expect(result.current.phase).toBe('revealed');
      expect(result.current.attempts).toBe(1);
      expect(result.current.result).toEqual({ correct: false, rating: 1 });
    });
  });

  describe('reveal', () => {
    it('is a no-op when attempts is 0', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.reveal(0));

      expect(result.current.phase).toBe('working');
      expect(result.current.result).toBeNull();
    });

    it('transitions to revealed with Hard (2) when fraction >= 0.5', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(false));
      act(() => result.current.reveal(0.5));

      expect(result.current.phase).toBe('revealed');
      expect(result.current.result).toEqual({ correct: false, rating: 2 });
      expect(result.current.isRevealedOrSolved).toBe(true);
    });

    it('uses the fraction passed to reveal for the auto-judged rating', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(false));
      act(() => result.current.reveal(0.6));

      expect(result.current.result).toEqual({ correct: false, rating: 2 });
    });

    it('transitions to revealed with Again (1) when fraction < 0.5', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(false));
      act(() => result.current.reveal(0.49));

      expect(result.current.phase).toBe('revealed');
      expect(result.current.result).toEqual({ correct: false, rating: 1 });
    });

    it('is a no-op when already solved', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(true));
      act(() => result.current.reveal(0));

      expect(result.current.phase).toBe('solved');
      expect(result.current.result).toEqual({ correct: true, rating: 4 });
    });

    it('is a no-op when already revealed', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(false));
      act(() => result.current.reveal(0.3));
      const firstResult = result.current.result;
      act(() => result.current.reveal(1));

      expect(result.current.result).toBe(firstResult);
    });
  });

  describe('markDirty', () => {
    it('sets dirty to true (call after a wrong check to re-enable Check)', () => {
      const { result } = renderHook(() => useCheckableExercise());

      act(() => result.current.check(false));
      expect(result.current.dirty).toBe(false);

      act(() => result.current.markDirty());
      expect(result.current.dirty).toBe(true);
    });
  });

  describe('shakeKey', () => {
    it('equals the attempts count (drives shake remount per wrong check)', () => {
      const { result } = renderHook(() => useCheckableExercise());

      expect(result.current.shakeKey).toBe(0);

      act(() => result.current.check(false));
      expect(result.current.shakeKey).toBe(1);

      act(() => result.current.markDirty());
      act(() => result.current.check(false));
      expect(result.current.shakeKey).toBe(2);
    });
  });
});

describe('useCheckableExercise — commit mode (allowRetry = false)', () => {
  describe('check', () => {
    it('transitions to solved with a binary correct result (no rating override) on a correct check', () => {
      const { result } = renderHook(() => useCheckableExercise(), {
        wrapper: withMode(false),
      });

      act(() => result.current.check(true));

      expect(result.current.phase).toBe('solved');
      expect(result.current.result).toEqual({ correct: true });
      expect(result.current.isRevealedOrSolved).toBe(true);
    });

    it('transitions to a terminal phase with a binary wrong result (no rating override) on a wrong check', () => {
      const { result } = renderHook(() => useCheckableExercise(), {
        wrapper: withMode(false),
      });

      act(() => result.current.check(false));

      // Terminal (NOT the 'wrong' retry phase), result has no rating so
      // ratingFromResult yields binary 1 (Again).
      expect(result.current.isRevealedOrSolved).toBe(true);
      expect(result.current.phase).not.toBe('wrong');
      expect(result.current.result).toEqual({ correct: false });
      expect(result.current.result?.rating).toBeUndefined();
    });

    it('is one-shot: a second check after a wrong commit is a no-op', () => {
      const { result } = renderHook(() => useCheckableExercise(), {
        wrapper: withMode(false),
      });

      act(() => result.current.check(false));
      const firstResult = result.current.result;

      // Try to check again — state must not change.
      act(() => result.current.check(true));

      expect(result.current.result).toBe(firstResult);
      expect(result.current.result).toEqual({ correct: false });
    });
  });

  describe('reveal', () => {
    it('canReveal is always false', () => {
      const { result } = renderHook(() => useCheckableExercise(), {
        wrapper: withMode(false),
      });

      // Before any check.
      expect(result.current.canReveal).toBe(false);

      // After a wrong check (which goes terminal).
      act(() => result.current.check(false));
      expect(result.current.canReveal).toBe(false);
    });

    it('reveal is a no-op even after a wrong check', () => {
      const { result } = renderHook(() => useCheckableExercise(), {
        wrapper: withMode(false),
      });

      act(() => result.current.check(false));
      const beforeReveal = result.current.result;

      act(() => result.current.reveal(0.5));

      expect(result.current.result).toBe(beforeReveal);
    });
  });

  describe('rating invariant (SRS)', () => {
    it('a correct commit yields rating 4 via ratingFromResult', async () => {
      const { ratingFromResult } = await import('@/lib/operationResult');
      const { result } = renderHook(() => useCheckableExercise(), {
        wrapper: withMode(false),
      });

      act(() => result.current.check(true));
      expect(ratingFromResult(result.current.result!)).toBe(4);
    });

    it('a wrong commit yields rating 1 via ratingFromResult', async () => {
      const { ratingFromResult } = await import('@/lib/operationResult');
      const { result } = renderHook(() => useCheckableExercise(), {
        wrapper: withMode(false),
      });

      act(() => result.current.check(false));
      expect(ratingFromResult(result.current.result!)).toBe(1);
    });
  });
});
