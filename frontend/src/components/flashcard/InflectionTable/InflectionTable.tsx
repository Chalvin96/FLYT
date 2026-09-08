import React from 'react';

import type { LemmaPos, WordFormRead } from '@/types/api';

import { AdjectiveInflectionTable } from './AdjectiveInflectionTable';
import { AdverbInflectionTable } from './AdverbInflectionTable';
import { NounInflectionTable } from './NounInflectionTable';
import { detectInflectionKind } from './utils';
import { VerbInflectionTable } from './VerbInflectionTable';

type InflectionLayout = 'auto' | 'horizontal' | 'vertical';

interface InflectionTableProps {
  wordForms: WordFormRead[];
  pos?: LemmaPos;
  layout?: InflectionLayout;
}

export const InflectionTable: React.FC<InflectionTableProps> = ({
  wordForms,
  pos,
  layout = 'auto',
}) => {
  const { isNoun, isAdjective, isAdverb, isVerb } = detectInflectionKind(
    wordForms,
    pos,
  );

  if (isVerb)
    return <VerbInflectionTable wordForms={wordForms} layout={layout} />;
  if (isAdjective)
    return <AdjectiveInflectionTable wordForms={wordForms} layout={layout} />;
  if (isAdverb)
    return <AdverbInflectionTable wordForms={wordForms} layout={layout} />;
  if (isNoun)
    return <NounInflectionTable wordForms={wordForms} layout={layout} />;

  return null;
};
