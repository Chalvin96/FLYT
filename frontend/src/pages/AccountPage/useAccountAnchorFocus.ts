import { useEffect } from 'react';

function getHash(): string {
  return window.location.hash.replace(/^#/, '');
}

function findHashTarget(): HTMLElement | null {
  const hash = getHash();
  if (!hash) return null;

  return document.getElementById(hash);
}

/**
 * Focuses the Account section named by the current hash while its data loads,
 * moving focus to the replacement heading when the loading or error branch is
 * swapped for the loaded section. Focus is only reclaimed from a target this
 * hook previously focused, so learner-driven focus changes are never stolen.
 */
export function useAccountAnchorFocus(): void {
  useEffect(() => {
    let focusedTarget: HTMLElement | null = null;

    const focusTarget = (target: HTMLElement) => {
      focusedTarget = target;
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: 'center' });
    };

    const syncFocus = () => {
      if (!getHash()) {
        focusedTarget = null;
        return;
      }

      const target = findHashTarget();
      if (!target || target === focusedTarget) return;

      const ownsFocus =
        focusedTarget === null ||
        document.activeElement === focusedTarget ||
        document.activeElement === document.body;
      if (!ownsFocus) return;

      focusTarget(target);
    };

    const observer = new MutationObserver(syncFocus);

    const handleHashChange = () => {
      focusedTarget = null;
      observer.disconnect();

      if (!getHash()) {
        return;
      }

      observer.observe(document.body, { childList: true, subtree: true });
      syncFocus();
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      observer.disconnect();
    };
  }, []);
}
