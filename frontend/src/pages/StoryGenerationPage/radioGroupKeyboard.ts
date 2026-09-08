import type { KeyboardEvent } from 'react';

export function radioGroupKeyDown(
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

    const next = findSelectable(radios, step.start, step.direction);
    if (next === null || next === currentIndex) {
      return;
    }

    event.preventDefault();
    radios[next].focus();
    onSelect(next);
  };
}

function findSelectable(
  radios: HTMLElement[],
  start: number,
  direction: 1 | -1,
): number | null {
  for (let step = 1; step <= radios.length; step += 1) {
    const index =
      (start + direction * step + radios.length * 2) % radios.length;
    if (radios[index].getAttribute('aria-disabled') !== 'true') {
      return index;
    }
  }
  return null;
}
