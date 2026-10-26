import { useNavigate } from '@tanstack/react-router';

import type { SessionLength } from '@/types/review';

declare module '@tanstack/react-router' {
  interface HistoryState {
    reviewSessionId?: string;
  }
}

export function useStartReviewSession() {
  const navigate = useNavigate();

  return (mode: SessionLength) => {
    void navigate({
      to: '/review/session',
      search: { mode },
      state: { reviewSessionId: crypto.randomUUID() },
    });
  };
}
