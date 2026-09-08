import { useEffect, useRef, useState } from "react";
import { Button } from "@flyt/ui";

import { ResultView } from "./LemmaResults";
import { ImportAction, SignInPrompt } from "./PopupActions";
import { SearchView } from "./SearchView";
import { SelectionPanels } from "./SelectionPanels";
import {
  deriveView,
  buildLookupKey,
  buildPopupAriaLabel,
  type Override,
} from "./popupView";
import { usePopupFocusTrap } from "./usePopupFocusTrap";
import { usePopupWordLookup } from "./usePopupWordLookup";

import type { LemmaContext, MsgResult } from "../lib/messages";
import type { ResolveResponse } from "../lib/resolve-types";

export type PopupState =
  | { kind: "hidden" }
  | { kind: "loading"; word: string; context?: LemmaContext }
  | { kind: "result"; res: ResolveResponse; context?: LemmaContext }
  | { kind: "selection"; selection: LemmaContext; text?: string }
  | { kind: "signIn" }
  | { kind: "error" };

type VisiblePopupState = Exclude<PopupState, { kind: "hidden" }>;

export function Popup({
  state,
  onImportPage,
  onClose,
  sessionId = 0,
}: {
  state: PopupState;
  onImportPage: () => Promise<MsgResult>;
  onClose?: () => void;
  sessionId?: number;
}) {
  const { handleKeyDown, panelRef } = usePopupFocusTrap(
    state.kind === "hidden",
  );

  if (state.kind === "hidden") return null;

  return (
    <div
      aria-label={buildPopupAriaLabel(state)}
      aria-modal="true"
      className="flyt-popup"
      onKeyDown={handleKeyDown}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      <PopupHeader onClose={onClose} />
      <div className="flyt-popup-body">
        <PopupBody key={buildLookupKey(state)} state={state} />
      </div>
      <ImportAction key={sessionId} onImportPage={onImportPage} />
    </div>
  );
}

function PopupHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flyt-logo-bar">
      <div className="flyt-logo-box">F</div>
      <span className="flyt-wordmark">Flyt</span>
      {onClose ? (
        <Button
          aria-label="Close"
          className="flyt-close-btn"
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          ×
        </Button>
      ) : null}
    </div>
  );
}

function PopupBody({ state }: { state: VisiblePopupState }) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [override, setOverride] = useState<Override>({ kind: "none" });
  const view = deriveView(override, state);

  const showResolved = (res: ResolveResponse) => {
    setOverride({ kind: "result", res });
  };
  const { invalidateLookup, resetLookup, resolveWord, wordLookup } =
    usePopupWordLookup(showResolved);

  useEffect(() => {
    if (override.kind === "search") searchInputRef.current?.focus();
  }, [override.kind]);

  const enterSearch = () => {
    invalidateLookup();
    const query = view.kind === "result" ? view.res.query : "";
    setOverride({ kind: "search", query });
  };

  const searchForWord = (word: string) => {
    invalidateLookup();
    resetLookup();
    setOverride({ kind: "search", query: word });
  };

  const backToTranslation = () => {
    invalidateLookup();
    setOverride({ kind: "none" });
    resetLookup();
  };

  return (
    <>
      {state.kind === "selection" ? (
        <SelectionPanels
          hasWordResult={override.kind === "result"}
          onBackToTranslation={backToTranslation}
          onResolveWord={(word) => void resolveWord(word)}
          onSearchWord={searchForWord}
          selection={state.selection}
          text={state.text}
          wordLookup={wordLookup}
        />
      ) : null}
      <PopupMainView
        enterSearch={enterSearch}
        onResolveWord={resolveWord}
        searchInputRef={searchInputRef}
        state={state}
        view={view}
      />
    </>
  );
}

function PopupMainView({
  enterSearch,
  onResolveWord,
  searchInputRef,
  state,
  view,
}: {
  enterSearch: () => void;
  onResolveWord: (word: string) => Promise<void>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  state: VisiblePopupState;
  view: ReturnType<typeof deriveView>;
}) {
  switch (view.kind) {
    case "loading":
      return <LoadingView word={view.word} />;
    case "result":
      return (
        <ResultView
          context={getResultContext(state)}
          onResolveWord={(word) => void onResolveWord(word)}
          onSearch={enterSearch}
          res={view.res}
        />
      );
    case "search":
      return (
        <SearchView
          initialQuery={view.query}
          inputRef={searchInputRef}
          onResolveWord={(word) => void onResolveWord(word)}
        />
      );
    case "signIn":
      return <SignInPrompt />;
    case "error":
      return <ErrorView />;
    default:
      return null;
  }
}

function getResultContext(state: VisiblePopupState): LemmaContext | undefined {
  if (state.kind === "selection") {
    return state.selection;
  }
  if (state.kind === "result") {
    return state.context;
  }
  return undefined;
}

function LoadingView({ word }: { word: string }) {
  return <div className="flyt-skel">{word + String.fromCharCode(8230)}</div>;
}

function ErrorView() {
  return <div className="flyt-err">Something went wrong.</div>;
}
