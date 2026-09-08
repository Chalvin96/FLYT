import { useMemo, type ReactNode } from 'react';

import { exerciseModeContext } from './ExerciseModeContext';

export function ExerciseModeProvider({
  allowRetry,
  children,
}: {
  allowRetry: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ allowRetry }), [allowRetry]);

  return (
    <exerciseModeContext.Provider value={value}>
      {children}
    </exerciseModeContext.Provider>
  );
}
