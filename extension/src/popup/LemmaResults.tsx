import { ChevronRight } from "lucide-react";
import { Text } from "@flyt/ui";
import { posLabel } from "@flyt/lexicon/grammar";

import { buildLemmaCardData } from "./lemmaCardData";
import { LemmaEntry } from "./LemmaEntry";
import type { ResolveResponse } from "../lib/resolve-types";
import type { useLemmaCandidates } from "./useLemmaCandidates";

export function ResultView({
  res,
  candidates,
  onResolveWord,
}: {
  res: ResolveResponse;
  candidates: ReturnType<typeof useLemmaCandidates>;
  onResolveWord: (word: string) => void;
}) {
  const [first, ...rest] = res.candidates;
  if (!first)
    return (
      <div className="px-4 py-4">
        <Text size="medium" tone="subtle">
          No entry for &quot;{res.query}&quot;.
        </Text>
      </div>
    );
  const entry = (candidate: typeof first) => (
    <LemmaEntry
      key={candidate.lemma_uuid}
      lemma={buildLemmaCardData(
        candidate,
        candidates.details[candidate.lemma_uuid],
      )}
      onResolveWord={onResolveWord}
    />
  );
  return (
    <>
      {entry(first)}
      {rest.map((candidate) => (
        <details
          className="group border-t border-default"
          key={candidate.lemma_uuid}
          onToggle={(event) =>
            candidates.setActiveUuid(
              event.currentTarget.open
                ? candidate.lemma_uuid
                : first.lemma_uuid,
            )
          }
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--border-focused)]">
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-icon-default group-open:rotate-90"
            />
            <Text as="span" size="medium" weight="semibold">
              {candidate.primary_display_form ?? candidate.word}
            </Text>
            <Text as="span" size="small" tone="subtle">
              {posLabel(candidate.pos)} ·{" "}
              {candidate.definitions[0]?.translation}
            </Text>
          </summary>
          {entry(candidate)}
        </details>
      ))}
    </>
  );
}
