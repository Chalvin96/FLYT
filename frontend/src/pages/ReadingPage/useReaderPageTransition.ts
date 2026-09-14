import { useEffect, useRef } from 'react';

export function useReaderPageTransition(settledPageIndex: number | undefined) {
  const articleRef = useRef<HTMLElement>(null);
  const settledIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (settledPageIndex === undefined) return;

    const previousIndex = settledIndexRef.current;
    settledIndexRef.current = settledPageIndex;
    if (previousIndex === null || previousIndex === settledPageIndex) return;

    const article = articleRef.current;
    if (!article) return;
    article.focus({ preventScroll: true });
    article.scrollIntoView({ block: 'start' });
  }, [settledPageIndex]);

  return articleRef;
}
