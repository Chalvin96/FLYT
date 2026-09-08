import {
  HomographCard,
  LemmaCardSkeleton,
} from '@/components/lookup/HomographCard';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { useBrowseHeadword } from '@/hooks/lexicon/queries';

export function ReaderDefinitionPanel() {
  const ctx = useLookupContext();

  if (ctx.isOpen && ctx.mode === 'search') return null;

  if (!ctx.isOpen || ctx.mode !== 'lemma' || !ctx.lemmaTarget) {
    return (
      <div className="flex h-full items-center justify-center px-5 py-8 text-center type-caption text-muted-foreground italic">
        Tap a word to look it up
      </div>
    );
  }

  return (
    <LemmaPanel
      wordText={ctx.lemmaTarget.wordText}
      lemmaUuid={ctx.lemmaTarget.lemmaUuid}
    />
  );
}

function LemmaPanel({
  wordText,
  lemmaUuid,
}: {
  wordText: string;
  lemmaUuid: string | null;
}) {
  const isBrowseMode = lemmaUuid === null;
  const browseQuery = useBrowseHeadword(isBrowseMode ? wordText : '');

  if (!isBrowseMode) {
    return (
      <div className="px-5 py-4" data-testid="definition-panel">
        <HomographCard lemmaUuid={lemmaUuid} />
      </div>
    );
  }

  const entries = browseQuery.data?.entries ?? [];
  const isFailed = browseQuery.isFetched && entries.length === 0;

  if (isFailed) {
    return (
      <div className="px-5 py-8 type-caption text-muted-foreground italic">
        No definition found for &ldquo;{wordText}&rdquo;.
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="px-5 py-4">
        <LemmaCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 py-4" data-testid="definition-panel">
      {entries.map((entry) => (
        <HomographCard key={entry.uuid} lemmaUuid={entry.uuid} />
      ))}
    </div>
  );
}
