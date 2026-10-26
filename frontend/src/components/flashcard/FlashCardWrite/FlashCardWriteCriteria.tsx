import { Text } from '@flyt/ui';
import { Check, X } from 'lucide-react';
import type { Ref } from 'react';

import { cn } from '@/lib/utils';
import type { WriteExercise, WriteJudgement } from '@/types/lesson-contracts';

import {
  criterionStatusText,
  verdictCriterionClass,
  verdictCriterionMarkerClass,
  type StatusVerdict,
} from '../answerVerdict';

type Criterion = WriteExercise['payload']['criteria'][number];
type CriterionJudgement = WriteJudgement['criteria'][number];

function buildCriterionVerdict(
  judgement: CriterionJudgement | undefined,
): StatusVerdict {
  if (!judgement) return 'idle';
  return judgement.met ? 'correct' : 'incorrect';
}

function normalizeForComparison(value: string): string {
  return value
    .toLocaleLowerCase('no')
    .replace(/[«»"“”„'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAdditionalEvidence(
  evidence: string,
  response: string,
  met: boolean,
): boolean {
  const quote = normalizeForComparison(evidence);
  const written = normalizeForComparison(response);
  if (!quote) return false;
  return met ? !written.includes(quote) : quote !== written;
}

function criteriaSummary(
  judged: boolean,
  metRequiredCriteriaCount: number,
  requiredCriteriaCount: number,
  totalCriteria: number,
): string {
  if (!judged) return 'What gets checked';
  if (metRequiredCriteriaCount === requiredCriteriaCount) {
    return requiredCriteriaCount === totalCriteria
      ? 'All criteria met'
      : 'Task requirements met';
  }
  return requiredCriteriaCount === totalCriteria
    ? `${metRequiredCriteriaCount} of ${requiredCriteriaCount} criteria met`
    : `${metRequiredCriteriaCount} of ${requiredCriteriaCount} required criteria met`;
}

function CriterionMarker({
  index,
  judgement,
}: {
  index: number;
  judgement: CriterionJudgement | undefined;
}) {
  const verdict = buildCriterionVerdict(judgement);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
        verdictCriterionMarkerClass[verdict],
      )}
    >
      {judgement ? (
        judgement.met ? (
          <Check className="size-3" />
        ) : (
          <X className="size-3" />
        )
      ) : (
        <Text as="span" role="eyebrow">
          {index + 1}
        </Text>
      )}
    </span>
  );
}

function CriterionCard({
  criterion,
  index,
  response,
  judgement,
}: {
  criterion: Criterion;
  index: number;
  response: string;
  judgement: CriterionJudgement | undefined;
}) {
  const evidence = judgement?.evidence?.trim();
  const showEvidence =
    Boolean(judgement && evidence) &&
    hasAdditionalEvidence(evidence ?? '', response, judgement?.met ?? false);
  const verdict = buildCriterionVerdict(judgement);

  return (
    <li className="min-w-0">
      <div
        className={cn(
          'radius-field flex h-full items-start gap-2 border p-3',
          verdictCriterionClass[verdict],
        )}
      >
        <CriterionMarker index={index} judgement={judgement} />
        <div className="min-w-0 flex-1">
          <Text size="medium" tone="subtle">
            {criterion.instruction}
            {judgement ? (
              <span className="sr-only">
                {' — '}
                {criterionStatusText[verdict]}
              </span>
            ) : null}
          </Text>
          {showEvidence ? (
            <div
              className="mt-1 line-clamp-2 border-l-2 border-default pl-2 italic"
              lang="no"
            >
              <Text size="small" tone="subtle">
                &ldquo;{evidence}&rdquo;
              </Text>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function CriteriaStrip({
  criteria,
  verdictById,
  judged,
  metRequiredCriteriaCount,
  requiredCriteriaCount,
  response,
  ref,
}: {
  criteria: Criterion[];
  verdictById: Map<string, CriterionJudgement>;
  judged: boolean;
  metRequiredCriteriaCount: number;
  requiredCriteriaCount: number;
  response: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col gap-2" data-testid="write-criteria" ref={ref}>
      <p className="sr-only" data-testid="write-criteria-summary" role="status">
        {criteriaSummary(
          judged,
          metRequiredCriteriaCount,
          requiredCriteriaCount,
          criteria.length,
        )}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2" role="list">
        {criteria.map((criterion, index) => (
          <CriterionCard
            criterion={criterion}
            index={index}
            key={criterion.id}
            response={response}
            judgement={judged ? verdictById.get(criterion.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
