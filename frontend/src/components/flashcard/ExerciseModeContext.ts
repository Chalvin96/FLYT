import { createContext } from 'react';

export interface ExerciseModeContextValue {
  allowRetry: boolean;
}

export const exerciseModeContext = createContext<ExerciseModeContextValue>({
  allowRetry: true,
});
