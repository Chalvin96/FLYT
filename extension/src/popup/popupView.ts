import type { LemmaContext } from "../lib/messages";
import type { ResolveResponse } from "../lib/resolve-types";
import type { PopupState } from "./Popup";
import type { WordLookup } from "./usePopupWordLookup";
export type VisiblePopupState = Exclude<PopupState, { kind: "hidden" }>;

export type SelectionFallback = {
  originalState: PopupState;
  sessionId: number;
  word: string;
};

export type Override =
  | { kind: "none" }
  | { kind: "search"; query: string }
  | { kind: "result"; res: ResolveResponse };

export type View =
  | { kind: "loading"; word: string }
  | { kind: "result"; res: ResolveResponse }
  | { kind: "selection"; selection: LemmaContext; text?: string }
  | { kind: "signIn" }
  | Extract<VisiblePopupState, { kind: "error" }>
  | { kind: "search"; query: string };

export function deriveView(
  override: Override,
  state: VisiblePopupState,
  wordLookup: WordLookup,
): View {
  if (state.kind !== "selection" || override.kind === "search") {
    if (wordLookup.kind === "loading") {
      return { kind: "loading", word: wordLookup.token.word };
    }
    if (wordLookup.kind === "error") {
      return {
        kind: "error",
        ...wordLookup.failure,
        word: wordLookup.token.word,
      };
    }
  }
  if (override.kind === "search") {
    return { kind: "search", query: override.query };
  }
  if (override.kind === "result") {
    return { kind: "result", res: override.res };
  }
  switch (state.kind) {
    case "result":
      return { kind: "result", res: state.res };
    case "loading":
      return { kind: "loading", word: state.word };
    case "selection":
      return state;
    case "signIn":
      return { kind: "signIn" };
    case "error":
      return state;
    default:
      return { kind: "search", query: "" };
  }
}

export function derivePopupState(
  state: PopupState,
  sessionId: number,
  fallback: SelectionFallback | null,
): PopupState {
  if (
    !fallback ||
    fallback.originalState !== state ||
    fallback.sessionId !== sessionId
  ) {
    return state;
  }
  return {
    kind: "selection",
    selection: findResultContext(state) ?? { source_sentence: fallback.word },
    text: fallback.word,
  };
}

export function findResultContext(state: PopupState): LemmaContext | undefined {
  if (state.kind === "selection") return state.selection;
  if (
    state.kind === "result" ||
    state.kind === "loading" ||
    state.kind === "error"
  )
    return state.context;
  return undefined;
}

export function buildLookupKey(state: VisiblePopupState): string {
  switch (state.kind) {
    case "loading":
      return state.word;
    case "result":
      return state.res.query;
    case "selection":
      return state.selection.source_sentence;
    case "error":
      return `error:${state.word ?? ""}:${state.error ?? "unknown"}`;
    default:
      return "__" + state.kind + "__";
  }
}

export function buildPopupAriaLabel(state: VisiblePopupState): string {
  switch (state.kind) {
    case "result": {
      const displayForm = state.res.candidates.find(
        (candidate) => candidate.primary_display_form,
      )?.primary_display_form;
      return "Definition of " + (displayForm ?? state.res.query);
    }
    case "loading":
      return "Looking up " + state.word;
    case "selection":
      return "Translate selected text";
    case "signIn":
      return "Sign in to Flyt";
    case "error":
      return "Something went wrong";
    default:
      return "Flyt";
  }
}
