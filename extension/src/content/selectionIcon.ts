import { createShadowHost } from '../popup/shadowHost';

export type SelectionIconHandle = {
  show(rect: DOMRect, onActivate: () => void): void;
  hide(): void;
};

// Kept in sync with .flyt-lookup-icon in popup.css; the flip needs the height
// before layout.
const ICON_SIZE = 28;
const GAP = 6;

export function mountSelectionIcon(): SelectionIconHandle {
  const { container, reactHost } = createShadowHost();
  container.style.cssText =
    'position:absolute;z-index:2147483647;top:0;left:0;display:none;';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'flyt-lookup-icon';
  button.setAttribute('aria-label', 'Look up with Flyt');
  button.textContent = 'F';
  reactHost.append(button);

  // mousedown outside a selection collapses the range the lookup needs.
  button.addEventListener('mousedown', (event) => event.preventDefault());

  let activate: () => void = () => {};
  button.addEventListener('click', () => activate());

  return {
    show(rect, onActivate) {
      activate = onActivate;
      if (!container.isConnected) document.body.appendChild(container);
      const fits = rect.bottom + GAP + ICON_SIZE < window.innerHeight;
      container.style.top = `${
        window.scrollY + (fits ? rect.bottom + GAP : rect.top - ICON_SIZE - GAP)
      }px`;
      container.style.left = `${window.scrollX + rect.right + GAP}px`;
      container.style.display = 'block';
    },
    hide() {
      container.style.display = 'none';
    },
  };
}
