import { useEffect, useRef, useState } from 'react';

import { useIsReducedMotionPreferred } from '@/hooks/ui/usePrefersReducedMotion';

export const RAIL_TRANSITION_MS = 200;

export interface RailPresence {
  reserved: boolean;
  visible: boolean;
}

/**
 * Keeps the desktop rail's grid column reserved until the panel finishes
 * leaving, then releases it. Only the panel animates; the grid never
 * transitions its column widths. State changes are scheduled on animation
 * frames so the reserved column and the moving panel are painted in the
 * right order. Callers can disable it on mobile so no desktop rail work is
 * scheduled there.
 */
export function useRailPresence(isOpen: boolean, enabled = true): RailPresence {
  const reducedMotion = useIsReducedMotionPreferred();
  const [reserved, setReserved] = useState(enabled && isOpen);
  const [visible, setVisible] = useState(enabled && isOpen);
  const releaseTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const clearScheduled = () => {
      if (releaseTimerRef.current !== null) {
        window.clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    clearScheduled();

    if (!enabled) {
      return clearScheduled;
    }

    if (isOpen) {
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setReserved(true);
        if (reducedMotion) {
          setVisible(true);
          return;
        }
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null;
          setVisible(true);
        });
      });
      return clearScheduled;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setVisible(false);
      if (reducedMotion) {
        setReserved(false);
        return;
      }
      releaseTimerRef.current = window.setTimeout(() => {
        releaseTimerRef.current = null;
        setReserved(false);
      }, RAIL_TRANSITION_MS);
    });
    return clearScheduled;
  }, [enabled, isOpen, reducedMotion]);

  return {
    reserved: enabled && reserved,
    visible: enabled && visible,
  };
}
