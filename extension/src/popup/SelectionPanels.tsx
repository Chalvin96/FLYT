import type { RefObject } from "react";
import { Button, Text } from "@flyt/ui";

import { SentenceView, type SentenceViewHandle } from "./SentenceView";
import { LookupError } from "./PopupError";
import type { LemmaContext } from "../lib/messages";
import type { TokenIdentity, WordLookup } from "./usePopupWordLookup";
import type { PopupFailure } from "./buildPopupError";

export function SelectionPanels({
  hasWordResult,
  onBackToTranslation,
  onResolveWord,
  onSearchWord,
  selection,
  text,
  visible,
  wordLookup,
  sentenceRef,
  onTranslationError,
}: {
  hasWordResult: boolean;
  onBackToTranslation: () => void;
  onResolveWord: (word: string, occurrence?: number) => void;
  onSearchWord: (word: string) => void;
  selection: LemmaContext;
  text?: string;
  visible: boolean;
  wordLookup: WordLookup;
  sentenceRef: RefObject<SentenceViewHandle | null>;
  onTranslationError: (failure: PopupFailure | null) => void;
}) {
  const activeToken: TokenIdentity | undefined =
    wordLookup.kind === "idle" ? undefined : wordLookup.token;

  return (
    <div hidden={!visible}>
      <SentenceView
        activeToken={activeToken}
        onResolveWord={(word, occurrence) => {
          if (
            hasWordResult &&
            activeToken?.word === word &&
            activeToken.occurrence === occurrence
          ) {
            onBackToTranslation();
          } else {
            onResolveWord(word, occurrence);
          }
        }}
        ref={sentenceRef}
        selection={selection}
        text={text}
        onTranslationError={onTranslationError}
        separateActions
      />
      {visible && (
        <WordLookupStatus onSearchWord={onSearchWord} wordLookup={wordLookup} />
      )}
    </div>
  );
}

function WordLookupStatus({
  onSearchWord,
  wordLookup,
}: {
  onSearchWord: (word: string) => void;
  wordLookup: WordLookup;
}) {
  if (wordLookup.kind === "loading") {
    return (
      <div role="status" className="mx-3.5 mt-2.5">
        <Text as="p" size="small" tone="subtle">
          Looking up &quot;{wordLookup.token.word}&quot;…
        </Text>
      </div>
    );
  }
  if (wordLookup.kind === "resolved") {
    return (
      <p className="sr-only" role="status">
        Showing the entry for &quot;{wordLookup.token.word}&quot;.
      </p>
    );
  }
  if (wordLookup.kind === "error") {
    return (
      <LookupError failure={wordLookup.failure} word={wordLookup.token.word} />
    );
  }
  if (wordLookup.kind === "notFound") {
    return (
      <div
        role="status"
        className="mx-3.5 mt-2.5 flex items-center justify-between gap-2"
      >
        <Text as="span" size="small" tone="subtle">
          No dictionary entry for &quot;{wordLookup.token.word}&quot;.
        </Text>
        <Button
          aria-label={`Search for "${wordLookup.token.word}"`}
          onClick={() => onSearchWord(wordLookup.token.word)}
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
