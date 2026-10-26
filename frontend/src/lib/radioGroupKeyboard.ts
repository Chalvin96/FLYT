import type { KeyboardEvent } from 'react';

export function buildRadioGroupKeyDownHandler(
  onSelect: (index: number) => void,
): (event: KeyboardEvent<HTMLElement>) => void {
  return (event) => {
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    const currentIndex = radios.findIndex((radio) => radio === event.target);
    if (currentIndex === -1) {
      return;
    }

    const key = event.key;
    const step: { start: number; direction: 1 | -1 } | null =
      key === 'ArrowRight' || key === 'ArrowDown'
        ? { start: currentIndex, direction: 1 }
        : key === 'ArrowLeft' || key === 'ArrowUp'
          ? { start: currentIndex, direction: -1 }
          : key === 'Home'
            ? { start: -1, direction: 1 }
            : key === 'End'
              ? { start: radios.length, direction: -1 }
              : null;
    if (!step) {
      return;
    }

    // preventDefault even when focus will not move: Home on the first option
    // must not scroll the page.
    event.preventDefault();

    const next =
      (step.start + step.direction + radios.length * 2) % radios.length;
    if (next !== currentIndex) {
      radios[next].focus();
    }
    if (radios[next].getAttribute('aria-disabled') !== 'true') {
      onSelect(next);
    }
  };
}
