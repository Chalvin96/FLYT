import { useEffect, useRef, useState } from "react";

import { PopupBody } from "./PopupBody";
import { LemmaActions } from "./LemmaActions";
import { ImportAction } from "./ImportAction";
import { ErrorActions } from "./PopupError";
import { PopupHeader } from "./PopupHeader";
import { LoadingActions } from "./PopupLoading";
import { SelectionPanels } from "./SelectionPanels";
import {
  deriveView,
  findResultContext,
  type Override,
  type VisiblePopupState,
  type View,
} from "./popupView";
import { usePopupWordLookup, type WordLookup } from "./usePopupWordLookup";
import { useLemmaCandidates } from "./useLemmaCandidates";
import type { ResolveCandidate } from "../lib/resolve-types";
import type { SentenceViewHandle } from "./SentenceView";
import type { usePageImport } from "./usePageImport";
import type { PopupFailure } from "./buildPopupError";

const NO_CANDIDATES: ResolveCandidate[] = [];

export function PopupContent({
  state,
  onClose,
  pageImport,
  onWordNotFound,
}: {
  state: VisiblePopupState;
  onClose?: () => void;
  pageImport: ReturnType<typeof usePageImport>;
  onWordNotFound?: (word: string) => void;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  const sentence = useRef<SentenceViewHandle>(null);
  const [override, setOverride] = useState<Override>({ kind: "none" });
  const [translationError, setTranslationError] = useState<PopupFailure | null>(
    null,
  );
  const { invalidateLookup, resetLookup, resolveWord, wordLookup } =
    usePopupWordLookup(
      (res) => setOverride({ kind: "result", res }),
      onWordNotFound,
    );
  const view = deriveView(override, state, wordLookup);
  const sentenceVisible =
    state.kind === "selection" && override.kind !== "search";
  const failure = findPopupFailure(
    view,
    wordLookup,
    sentenceVisible ? translationError : null,
  );
  const loadingWord = view.kind === "loading" ? view.word : null;
  const importable = !failure && view.kind !== "signIn";
  const context = findResultContext(state);
  const candidates = useLemmaCandidates(
    view.kind === "result" ? view.res.candidates : NO_CANDIDATES,
    context,
  );

  useEffect(() => {
    if (override.kind === "search") searchInput.current?.focus();
  }, [override.kind]);

  const enterSearch = (
    query = view.kind === "result" ? view.res.query : "",
  ) => {
    invalidateLookup();
    resetLookup();
    setOverride({ kind: "search", query });
  };
  const backToTranslation = () => {
    invalidateLookup();
    resetLookup();
    setOverride({ kind: "none" });
  };
  const selection = state.kind === "selection" && (
    <SelectionPanels
      hasWordResult={override.kind === "result"}
      onBackToTranslation={backToTranslation}
      onResolveWord={(word, occurrence) => void resolveWord(word, occurrence)}
      onSearchWord={enterSearch}
      selection={state.selection}
      text={state.text}
      visible={sentenceVisible}
      wordLookup={wordLookup}
      sentenceRef={sentence}
      onTranslationError={setTranslationError}
    />
  );
  const retry = () => {
    if (sentenceVisible && wordLookup.kind === "error")
      void resolveWord(wordLookup.token.word, wordLookup.token.occurrence);
    else if (sentenceVisible) sentence.current?.retryTranslation();
    else {
      const word = findRetryWord(view, wordLookup);
      if (word) void resolveWord(word);
    }
  };
  const showResult = view.kind === "result";

  return (
    <div
      aria-busy={loadingWord !== null}
      className="flex max-h-(--radix-popover-content-available-height) flex-col overflow-hidden rounded-[inherit]"
    >
      <div className="flex max-h-140 flex-col overflow-hidden rounded-[inherit]">
        <PopupHeader
          onClose={onClose}
          onSearch={importable ? () => enterSearch() : undefined}
          searching={view.kind === "search"}
        />
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {selection}
          <PopupBody
            view={view}
            candidates={candidates}
            searchInput={searchInput}
            onResolveWord={(word) => void resolveWord(word)}
          />
        </div>
        {showResult && !failure && (
          <LemmaActions
            candidates={candidates}
            hasContext={context !== undefined}
          />
        )}
        {loadingWord && <LoadingActions />}
        {failure && <ErrorActions failure={failure} onRetry={retry} />}
        {importable && (
          <ImportAction
            status={pageImport.status}
            onImportPage={() => void pageImport.importPage()}
            title={context?.source_title ?? document.title}
          />
        )}
      </div>
    </div>
  );
}

function findPopupFailure(
  view: View,
  wordLookup: WordLookup,
  translationError: PopupFailure | null,
): PopupFailure | null {
  if (wordLookup.kind === "error") return wordLookup.failure;
  if (translationError) return translationError;
  if (view.kind !== "error") return null;
  return { ok: false, error: view.error ?? "unknown", message: view.message };
}

function findRetryWord(view: View, wordLookup: WordLookup) {
  if (wordLookup.kind !== "idle") return wordLookup.token.word;
  return view.kind === "error" ? view.word : undefined;
}
