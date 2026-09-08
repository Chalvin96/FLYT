import { selectionWord } from '../lib/selectionWord';
import type { SelectionIconHandle } from './selectionIcon';

const EDITABLE_SELECTOR =
  'input, textarea, [contenteditable=""], [contenteditable="true"]';

function isEditableSelection(selection: Selection): boolean {
  const node = selection.anchorNode;
  const element =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node?.parentElement ?? null);
  return element?.closest(EDITABLE_SELECTOR) != null;
}

// A textarea's own selection never reaches the document Selection.
function isEditableFocused(): boolean {
  const active = document.activeElement;
  return active != null && active.matches(EDITABLE_SELECTOR);
}

export function watchSelection(
  icon: SelectionIconHandle,
  onLookup: (word: string, rect: DOMRect) => void,
): () => void {
  const onSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || isEditableFocused()) {
      icon.hide();
      return;
    }

    const word = selectionWord(selection.toString());
    if (isEditableSelection(selection)) {
      icon.hide();
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!word) {
      icon.hide();
      return;
    }
    icon.show(rect, () => {
      icon.hide();
      onLookup(word, rect);
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') icon.hide();
  };

  // Positioned against the document, so a scroll strands it.
  const onScroll = () => icon.hide();

  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    document.removeEventListener('selectionchange', onSelectionChange);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('scroll', onScroll);
  };
}
