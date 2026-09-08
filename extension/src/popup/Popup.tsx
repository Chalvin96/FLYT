import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "@flyt/ui";

import { SentenceView } from "./SentenceView";
import { ResultView } from "./LemmaResults";
import { SearchView } from "./SearchView";
import { ImportAction, SignInPrompt } from "./PopupActions";

import {
  MSG_KIND,
  MSG_RESULT_KIND,
  sendMessage,
  type LemmaContext,
} from "../lib/messages";
import type { MsgResult } from "../lib/messages";
import type { ResolveResponse } from "../lib/resolve-types";

export type PopupState =
  | { kind: "hidden" }
  | { kind: "loading"; word: string; context?: LemmaContext }
  | { kind: "result"; res: ResolveResponse; context?: LemmaContext }
  | { kind: "selection"; selection: LemmaContext; text?: string }
  | { kind: "signIn" }
  | { kind: "error" };

type VisiblePopupState = Exclude<PopupState, { kind: "hidden" }>;

type Override =
  | { kind: "none" }
  | { kind: "search"; query: string }
  | { kind: "result"; res: ResolveResponse };

type View =
  | { kind: "loading"; word: string }
  | { kind: "result"; res: ResolveResponse }
  | { kind: "selection"; selection: LemmaContext }
  | { kind: "signIn" }
  | { kind: "error" }
  | { kind: "search"; query: string };


const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const isHidden = state.kind === "hidden";

  useEffect(() => {
    if (isHidden) {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
      return;
    }
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel).focus();
  }, [isHidden]);

  if (isHidden) return null;

  const lookupKey =
    state.kind === "loading"
      ? state.word
      : state.kind === "result"
        ? state.res.query
        : state.kind === "selection"
          ? state.selection.source_sentence
        : "__" + state.kind + "__";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const root = panel.getRootNode();
    const active = (
      root instanceof ShadowRoot ? root.activeElement : document.activeElement
    ) as HTMLElement | null;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const ariaLabel =
    state.kind === "result"
      ? "Definition of " + state.res.query
      : state.kind === "loading"
        ? "Looking up " + state.word
        : state.kind === "selection"
          ? "Translate selected text"
        : state.kind === "signIn"
          ? "Sign in to Flyt"
          : state.kind === "error"
            ? "Something went wrong"
            : "Flyt";

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flyt-popup"
    >
      <div className="flyt-logo-bar">
        <div className="flyt-logo-box">F</div>
        <span className="flyt-wordmark">Flyt</span>
        {onClose && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="flyt-close-btn"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </Button>
        )}
      </div>
      <div className="flyt-popup-body">
        <PopupBody key={lookupKey} state={state} />
      </div>
      <ImportAction key={sessionId} onImportPage={onImportPage} />
    </div>
  );
}

function PopupBody({ state }: { state: VisiblePopupState }) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [override, setOverride] = useState<Override>({ kind: "none" });
  const [wordLookup, setWordLookup] = useState<
    | { kind: "idle" }
    | { kind: "loading" | "error" | "notFound"; word: string }
  >({ kind: "idle" });
  const resolveRequestRef = useRef(0);
  const aliveRef = useRef(true);

  useEffect(() => {
    if (override.kind === "search") searchInputRef.current?.focus();
  }, [override.kind]);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
      resolveRequestRef.current += 1;
    };
  }, []);

  const view: View =
    override.kind === "search"
      ? { kind: "search", query: override.query }
      : override.kind === "result"
        ? { kind: "result", res: override.res }
        : state.kind === "result"
          ? { kind: "result", res: state.res }
          : state.kind === "loading"
            ? { kind: "loading", word: state.word }
            : state.kind === "selection"
              ? { kind: "selection", selection: state.selection }
            : state.kind === "signIn"
              ? { kind: "signIn" }
              : state.kind === "error"
                ? { kind: "error" }
                : { kind: "search", query: "" };

  const enterSearch = () => {
    resolveRequestRef.current += 1;
    const query = view.kind === "result" ? view.res.query : "";
    setOverride({ kind: "search", query });
  };

  const searchForWord = (word: string) => {
    resolveRequestRef.current += 1;
    setWordLookup({ kind: "idle" });
    setOverride({ kind: "search", query: word });
  };

  const showResolved = (res: ResolveResponse) => {
    if (aliveRef.current) setOverride({ kind: "result", res });
  };

  const resolveWord = async (word: string) => {
    const requestId = ++resolveRequestRef.current;
    setWordLookup({ kind: "loading", word });
    try {
      const result = await sendMessage({ kind: MSG_KIND.RESOLVE, word });
      if (
        requestId === resolveRequestRef.current &&
        result.ok &&
        result.kind === MSG_RESULT_KIND.RESOLVE
      ) {
        if (result.data.candidates.length > 0) {
          showResolved(result.data);
          setWordLookup({ kind: "idle" });
        } else {
          setWordLookup({ kind: "notFound", word });
        }
      } else if (requestId === resolveRequestRef.current) {
        setWordLookup({ kind: "error", word });
      }
    } catch {
      if (requestId === resolveRequestRef.current) {
        setWordLookup({ kind: "error", word });
      }
    }
  };

  return (
    <>
      {state.kind === "selection" && (
        <SentenceView
          selection={state.selection}
          text={state.text}
          activeWord={wordLookup.kind === "idle" ? undefined : wordLookup.word}
          onResolveWord={(word) => void resolveWord(word)}
        />
      )}
      {state.kind === "selection" && wordLookup.kind === "loading" && (
        <p className="flyt-word-lookup-status" role="status">
          Looking up &quot;{wordLookup.word}&quot;…
        </p>
      )}
      {state.kind === "selection" && wordLookup.kind === "error" && (
        <div className="flyt-word-lookup-error" role="alert">
          <span>Could not find &quot;{wordLookup.word}&quot;.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void resolveWord(wordLookup.word)}
          >
            Retry
          </Button>
        </div>
      )}
      {state.kind === "selection" && wordLookup.kind === "notFound" && (
        <div className="flyt-word-lookup-empty" role="status">
          <span>No dictionary entry for &quot;{wordLookup.word}&quot;.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => searchForWord(wordLookup.word)}
          >
            Search
          </Button>
        </div>
      )}
      {state.kind === "selection" && override.kind === "result" && (
        <Button
          size="sm"
          variant="ghost"
          className="flyt-back-to-translation"
          onClick={() => {
            resolveRequestRef.current += 1;
            setOverride({ kind: "none" });
            setWordLookup({ kind: "idle" });
          }}
        >
          Back to translation
        </Button>
      )}
      {view.kind === "loading" && <LoadingView word={view.word} />}
      {view.kind === "result" && (
        <ResultView
          res={view.res}
          onSearch={enterSearch}
          onResolveWord={(word) => void resolveWord(word)}
          context={
            state.kind === "selection"
              ? state.selection
              : state.kind === "result"
                ? state.context
                : undefined
          }
        />
      )}
      {view.kind === "search" && (
        <SearchView
          inputRef={searchInputRef}
          initialQuery={view.query}
          onResolveWord={(word) => void resolveWord(word)}
        />
      )}
      {view.kind === "signIn" && <SignInPrompt />}
      {view.kind === "error" && <ErrorView />}
    </>
  );
}

function LoadingView({ word }: { word: string }) {
  return <div className="flyt-skel">{word + String.fromCharCode(8230)}</div>;
}

function ErrorView() {
  return <div className="flyt-err">Something went wrong.</div>;
}
