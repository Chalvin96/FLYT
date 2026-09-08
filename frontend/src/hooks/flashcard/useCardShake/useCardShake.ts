import { useAnimationControls } from 'motion/react';
import { useCallback } from 'react';

const DEFAULT_SHAKE_X = [0, -7, 7, -6, 6, -3, 3, 0];

export function useCardShake() {
  const controls = useAnimationControls();

  const shake = useCallback(() => {
    void controls.start({
      x: DEFAULT_SHAKE_X,
      transition: {
        duration: 0.3,
        ease: 'easeInOut',
      },
    });
  }, [controls]);

  return { controls, shake };
}
