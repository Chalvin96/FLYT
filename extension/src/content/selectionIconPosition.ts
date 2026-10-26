const ICON_SIZE = 32;
const TOUCH_TARGET = 44;
const TARGET_OVERHANG = (TOUCH_TARGET - ICON_SIZE) / 2;
const GAP = 6;

export function getSelectionIconPosition(rect: DOMRect) {
  const fits =
    rect.bottom + GAP + ICON_SIZE + TARGET_OVERHANG < window.innerHeight;

  return {
    top: `${
      window.scrollY + (fits ? rect.bottom + GAP : rect.top - ICON_SIZE - GAP)
    }px`,
    left: `${window.scrollX + rect.right + GAP}px`,
  };
}
