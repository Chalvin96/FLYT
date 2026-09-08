import { Check, X } from 'lucide-react';
import type { Ref } from 'react';

import { cn } from '@/lib/utils';
import type { WriteExercise, WriteJudgement } from '@/types/lesson-contracts';

type Criterion = WriteExercise['payload']['criteria'][number];
type Verdict = WriteJudgement['criteria'][number];

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
  metCount: number,
  total: number,
): string {
  if (!judged) return 'What gets checked';
  if (metCount === total) return 'All criteria met';
  return `${metCount} of ${total} criteria met`;
}

function CriterionMarker({
  index,
  verdict,
}: {
  index: number;
  verdict: Verdict | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'type-label-xs mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
        verdict
          ? verdict.met
            ? 'border-accent-20 bg-accent-0 text-accent-90'
            : 'border-destructive-20 bg-destructive-0 text-destructive-80'
          : 'border-border bg-card text-muted-foreground',
      )}
    >
      {verdict ? (
        verdict.met ? (
          <Check className="size-3" />
        ) : (
          <X className="size-3" />
        )
      ) : (
        index + 1
      )}
    </span>
  );
}

function CriterionCard({
  criterion,
  index,
  response,
  verdict,
}: {
  criterion: Criterion;
  index: number;
  response: string;
  verdict: Verdict | undefined;
}) {
  const evidence = verdict?.evidence?.trim();
  const showEvidence =
    Boolean(verdict && evidence) &&
    hasAdditionalEvidence(evidence ?? '', response, verdict?.met ?? false);

  return (
    <li className="min-w-0">
      <div
        className={cn(
          'radius-field flex h-full items-start gap-2 border p-3',
          verdict?.met
            ? 'border-accent-20 bg-accent-0'
            : verdict
              ? 'border-destructive-20 bg-destructive-0'
              : 'border-border bg-card/60',
        )}
      >
        <CriterionMarker index={index} verdict={verdict} />
        <div className="min-w-0 flex-1">
          <p className="type-caption text-muted-foreground">
            {criterion.instruction}
            {verdict ? (
              <span className="sr-only">
                {verdict.met ? ' — met' : ' — not met'}
              </span>
            ) : null}
          </p>
          {showEvidence ? (
            <p
              className="type-caption-sm mt-1 line-clamp-2 border-l-2 border-border pl-2 text-muted-foreground italic"
              lang="no"
            >
              &ldquo;{evidence}&rdquo;
            </p>
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
  metCount,
  response,
  ref,
}: {
  criteria: Criterion[];
  verdictById: Map<string, Verdict>;
  judged: boolean;
  metCount: number;
  response: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col gap-2" data-testid="write-criteria" ref={ref}>
      <p className="sr-only" data-testid="write-criteria-summary" role="status">
        {criteriaSummary(judged, metCount, criteria.length)}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2" role="list">
        {criteria.map((criterion, index) => (
          <CriterionCard
            criterion={criterion}
            index={index}
            key={criterion.id}
            response={response}
            verdict={judged ? verdictById.get(criterion.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
