import { useContext } from 'react';

import {
  exerciseModeContext,
  type ExerciseModeContextValue,
} from './ExerciseModeContext';

export function useExerciseMode(): ExerciseModeContextValue {
  return useContext(exerciseModeContext);
}
