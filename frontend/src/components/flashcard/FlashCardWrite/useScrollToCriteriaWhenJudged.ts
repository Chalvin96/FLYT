import { useEffect, useRef } from 'react';

/** Scrolls the criteria strip into view once a judgement lands. */
export function useScrollToCriteriaWhenJudged(judged: boolean) {
  const criteriaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (judged) criteriaRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [judged]);

  return criteriaRef;
}
