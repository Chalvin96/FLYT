import type { FlytChatbotModel } from './types';

export function calculateNextModelIndex(
  key: string,
  currentIndex: number,
  models: readonly FlytChatbotModel[],
  isModelUsable: (model: FlytChatbotModel) => boolean,
): number | null {
  if (key === 'Home') {
    const firstUsableIndex = models.findIndex(isModelUsable);
    return firstUsableIndex === -1 ? null : firstUsableIndex;
  }

  if (key === 'End') {
    for (let index = models.length - 1; index >= 0; index -= 1) {
      const model = models[index];
      if (model && isModelUsable(model)) return index;
    }
    return null;
  }

  const direction =
    key === 'ArrowDown' || key === 'ArrowRight'
      ? 1
      : key === 'ArrowUp' || key === 'ArrowLeft'
        ? -1
        : null;
  if (direction === null) return null;

  for (let offset = 1; offset <= models.length; offset += 1) {
    const nextIndex =
      (currentIndex + direction * offset + models.length) % models.length;
    const nextModel = models[nextIndex];
    if (nextModel && isModelUsable(nextModel)) return nextIndex;
  }

  return null;
}
