import { Button } from "@flyt/ui";

import { SentenceView } from "./SentenceView";
import type { LemmaContext } from "../lib/messages";
import type { WordLookup } from "./usePopupWordLookup";

/**
 * Sentence-translation surface plus the inline status of the most recent
 * word tap: loading, failure (retry), no-entry (search), and the way back
 * from an opened word result.
 */
export function SelectionPanels({
  hasWordResult,
  onBackToTranslation,
  onResolveWord,
  onSearchWord,
  selection,
  text,
  wordLookup,
}: {
  hasWordResult: boolean;
  onBackToTranslation: () => void;
  onResolveWord: (word: string) => void;
  onSearchWord: (word: string) => void;
  selection: LemmaContext;
  text?: string;
  wordLookup: WordLookup;
}) {
  return (
    <>
      <SentenceView
        activeWord={wordLookup.kind === "idle" ? undefined : wordLookup.word}
        onResolveWord={onResolveWord}
        selection={selection}
        text={text}
      />
      <WordLookupStatus
        onResolveWord={onResolveWord}
        onSearchWord={onSearchWord}
        wordLookup={wordLookup}
      />
      {hasWordResult ? (
        <Button
          className="flyt-back-to-translation"
          onClick={onBackToTranslation}
          size="sm"
          variant="ghost"
        >
          Back to translation
        </Button>
      ) : null}
    </>
  );
}

function WordLookupStatus({
  onResolveWord,
  onSearchWord,
  wordLookup,
}: {
  onResolveWord: (word: string) => void;
  onSearchWord: (word: string) => void;
  wordLookup: WordLookup;
}) {
  if (wordLookup.kind === "loading") {
    return (
      <p className="flyt-word-lookup-status" role="status">
        Looking up &quot;{wordLookup.word}&quot;…
      </p>
    );
  }
  if (wordLookup.kind === "error") {
    return (
      <div className="flyt-word-lookup-error" role="alert">
        <span>Could not find &quot;{wordLookup.word}&quot;.</span>
        <Button
          onClick={() => onResolveWord(wordLookup.word)}
          size="sm"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  if (wordLookup.kind === "notFound") {
    return (
      <div className="flyt-word-lookup-empty" role="status">
        <span>No dictionary entry for &quot;{wordLookup.word}&quot;.</span>
        <Button
          onClick={() => onSearchWord(wordLookup.word)}
          size="sm"
          variant="outline"
        >
          Search
        </Button>
      </div>
    );
  }
  return null;
}
