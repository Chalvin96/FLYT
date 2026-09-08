import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCardShake } from './useCardShake';

const startMock = vi.fn();

vi.mock('motion/react', () => ({
  useAnimationControls: () => ({
    start: startMock,
  }),
}));

describe('useCardShake', () => {
  beforeEach(() => {
    startMock.mockReset();
    startMock.mockResolvedValue(undefined);
  });

  it('starts shake animation with expected values', () => {
    const { result } = renderHook(() => useCardShake());

    result.current.shake();

    expect(startMock).toHaveBeenCalledWith({
      x: [0, -7, 7, -6, 6, -3, 3, 0],
      transition: {
        duration: 0.3,
        ease: 'easeInOut',
      },
    });
  });
});
