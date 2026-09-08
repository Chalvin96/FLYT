import type { LemmaContext } from "../lib/messages";
import type { ResolveResponse } from "../lib/resolve-types";
import type { PopupState } from "./Popup";
export type VisiblePopupState = Exclude<PopupState, { kind: "hidden" }>;

export type Override =
  | { kind: "none" }
  | { kind: "search"; query: string }
  | { kind: "result"; res: ResolveResponse };

export type View =
  | { kind: "loading"; word: string }
  | { kind: "result"; res: ResolveResponse }
  | { kind: "selection"; selection: LemmaContext }
  | { kind: "signIn" }
  | { kind: "error" }
  | { kind: "search"; query: string };

/**
 * The override the user drove from inside the popup (search / picked
 * result) wins over the state the extension pushed in.
 */
export function deriveView(override: Override, state: VisiblePopupState): View {
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
      return { kind: "selection", selection: state.selection };
    case "signIn":
      return { kind: "signIn" };
    case "error":
      return { kind: "error" };
    default:
      return { kind: "search", query: "" };
  }
}

/** Remounts the body when the underlying lookup target changes. */
export function buildLookupKey(state: VisiblePopupState): string {
  switch (state.kind) {
    case "loading":
      return state.word;
    case "result":
      return state.res.query;
    case "selection":
      return state.selection.source_sentence;
    default:
      return "__" + state.kind + "__";
  }
}

export function buildPopupAriaLabel(state: VisiblePopupState): string {
  switch (state.kind) {
    case "result":
      return "Definition of " + state.res.query;
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
