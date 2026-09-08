import type { ComponentType } from 'react';

import {
  FlashCardType,
  type FlashCardRenderable,
  type WordFormRead,
} from '@/types/api';
import type { Operation } from '@/types/lesson-contracts';

import { FlashCardBuild } from './FlashCardBuild/FlashCardBuild';
import { FlashCardCategorize } from './FlashCardCategorize/FlashCardCategorize';
import { FlashCardChoose } from './FlashCardChoose/FlashCardChoose';
import { FlashCardDefinition } from './FlashCardDefinition/FlashCardDefinition';
import { FlashCardFindFix } from './FlashCardFindFix/FlashCardFindFix';
import { FlashCardJudge } from './FlashCardJudge/FlashCardJudge';
import { FlashCardMatch } from './FlashCardMatch/FlashCardMatch';
import { FlashCardRecallFill } from './FlashCardRecallFill/FlashCardRecallFill';
import { FlashCardSpeak } from './FlashCardSpeak/FlashCardSpeak';
import { FlashCardWrite } from './FlashCardWrite/FlashCardWrite';
import type { OperationComponentProps } from './operationTypes';

export type FlashCardComponentProps = {
  card: FlashCardRenderable;
  onFinished?: (rating: number) => void;
  isSubmitting?: boolean;
  className?: string;
  desktopExpanded?: boolean;
  wordForms?: WordFormRead[];
};

export const K_FLASHCARD_COMPONENT_MAP = {
  [FlashCardType.DEFINITION]: FlashCardDefinition,
} satisfies Partial<
  Record<FlashCardType, ComponentType<FlashCardComponentProps>>
>;

type OperationRenderer = ComponentType<OperationComponentProps>;

function asOperationRenderer<T>(
  Component: ComponentType<OperationComponentProps<T>>,
): OperationRenderer {
  return Component as unknown as OperationRenderer;
}

export const K_OPERATION_COMPONENT_MAP: Partial<
  Record<Operation, OperationRenderer>
> = {
  choose: asOperationRenderer(FlashCardChoose),
  recall_fill: asOperationRenderer(FlashCardRecallFill),
  match_pairs: asOperationRenderer(FlashCardMatch),
  build: asOperationRenderer(FlashCardBuild),
  judge: asOperationRenderer(FlashCardJudge),
  find_fix: asOperationRenderer(FlashCardFindFix),
  categorize: asOperationRenderer(FlashCardCategorize),
  speak: asOperationRenderer(FlashCardSpeak),
  write: asOperationRenderer(FlashCardWrite),
};
