import { Heading } from '@flyt/ui';
import type { ClosedProps } from '@flyt/ui';

export type ExercisePromptProps = ClosedProps<'h2'>;

export function ExercisePrompt(props: ExercisePromptProps) {
  return <Heading {...props} as="h2" size="fluid" />;
}
