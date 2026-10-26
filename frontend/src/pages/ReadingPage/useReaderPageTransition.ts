import { useEffect, useRef } from 'react';

export function useReaderPageTransition(
  settledPageIndex: number | undefined,
  finished = false,
  onTransition?: (article: HTMLElement | null) => void,
) {
  const articleRef = useRef<HTMLElement>(null);
  const settledViewRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (settledPageIndex === undefined) return;
    const view = `${settledPageIndex}:${finished}`;
    const previous = settledViewRef.current;
    settledViewRef.current = view;
    if (previous === undefined || previous === view) return;
    const article = articleRef.current;
    onTransition?.(article);
    if (!article) return;
    article.focus({ preventScroll: true });
    const scroller = article.closest('main');
    if (scroller) scroller.scrollTop = 0;
  }, [settledPageIndex, finished, onTransition]);

  return articleRef;
}
