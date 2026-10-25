import { useState } from "react";
import type { LemmaCardData, DefinitionRead } from "@flyt/lexicon";
import { PronunciationRow } from "@flyt/lexicon";
import { posLabel } from "@flyt/lexicon/grammar";
import { Badge, Button, Text } from "@flyt/ui";

export function LemmaEntry({
  lemma,
  onResolveWord,
}: {
  lemma: LemmaCardData;
  onResolveWord: (word: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const definitions = expanded
    ? lemma.definitions
    : lemma.definitions.slice(0, 1);
  const remaining = lemma.definitions.length - 1;
  return (
    <article
      className="space-y-4 px-4 pb-5 pt-5"
      aria-label={`${lemma.word} dictionary`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Text as="h2" size="2xl" weight="bold">
          {lemma.primary_display_form ?? lemma.word}
        </Text>
        <Badge>{posLabel(lemma.pos)}</Badge>
      </div>
      <PronunciationRow
        ipa={lemma.ipa}
        ipaApproximate={lemma.ipa_approximate}
        intonation={lemma.intonation}
        audioUrl={lemma.audio_url}
      />
      <div className="space-y-2">
        {!!lemma.alternative_forms?.length && (
          <Text size="small" tone="subtle">
            <Text as="span" size="small" weight="semibold">
              Other forms
            </Text>
            {"　"}
            {lemma.alternative_forms.join(" · ")}
          </Text>
        )}
        {lemma.primary_translation && (
          <Text size="large" weight="bold">
            {lemma.primary_translation}
          </Text>
        )}
      </div>
      {definitions.map((definition) => (
        <EntryDefinition key={definition.uuid} definition={definition} />
      ))}
      {remaining > 0 && (
        <Button
          variant="link"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Fewer meanings" : `More meanings (${remaining})`}
        </Button>
      )}
      {!!lemma.see_also?.length && (
        <div className="flex flex-wrap gap-2">
          {lemma.see_also.map((entry) =>
            entry.target_lemma_uuid ? (
              <Button
                key={entry.article_id}
                variant="link"
                size="sm"
                onClick={() => onResolveWord(entry.word)}
              >
                {entry.relation === "compare" ? "Compare" : "See"} {entry.word}
              </Button>
            ) : (
              <Text as="span" key={entry.article_id} size="small" tone="subtle">
                See {entry.word}
              </Text>
            ),
          )}
        </div>
      )}
    </article>
  );
}

function EntryDefinition({ definition }: { definition: DefinitionRead }) {
  return (
    <div className="space-y-1.5">
      <Text size="medium" tone="default">
        {definition.definition}
      </Text>
      {definition.translation && (
        <Text size="small" tone="subtle">
          {definition.translation}
        </Text>
      )}
      {definition.examples_json.map((example) => (
        <div className="space-y-1" key={`${example.no}-${example.en ?? ""}`}>
          <Text size="small" lang="nb">
            {example.no}
          </Text>
          {example.en && (
            <Text size="small" tone="subtle" lang="en">
              {example.en}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
}
