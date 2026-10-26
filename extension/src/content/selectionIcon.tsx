import { hideIcon, showIcon } from "../popup/overlay";
import { getSelectionIconPosition } from "./selectionIconPosition";

export type SelectionIconHandle = {
  show(rect: DOMRect, onActivate: () => void): void;
  hide(): void;
};

export function mountSelectionIcon(): SelectionIconHandle {
  return {
    show(rect, onActivate) {
      showIcon(getSelectionIconPosition(rect), onActivate);
    },
    hide: hideIcon,
  };
}
