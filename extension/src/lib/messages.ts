import type {
  LemmaDefinitionsResponse,
  ResolveResponse,
} from './resolve-types';

export type LemmaContext = {
  source_sentence: string;
  source_title?: string;
};

export const LEMMA_CONTEXT_MAX_SENTENCE_LENGTH = 2000;
export const LEMMA_CONTEXT_MAX_TITLE_LENGTH = 300;

function truncateCodePoints(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join('');
}

export function boundLemmaContext(context: LemmaContext): LemmaContext {
  const sourceTitle = context.source_title?.trim();
  return {
    source_sentence: truncateCodePoints(
      context.source_sentence,
      LEMMA_CONTEXT_MAX_SENTENCE_LENGTH,
    ),
    source_title: sourceTitle
      ? truncateCodePoints(sourceTitle, LEMMA_CONTEXT_MAX_TITLE_LENGTH)
      : undefined,
  };
}

export type TranslationResponse = {
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
};

export const MSG_KIND = {
  RESOLVE: 'resolve',
  DETAIL: 'detail',
  SEARCH: 'search',
  ADD: 'add',
  KNOW: 'know',
  IMPORT_PAGE: 'importPage',
  TRANSLATE: 'translate',
  SIGN_IN: 'signIn',
} as const;

export const MSG_RESULT_KIND = {
  RESOLVE: 'resolve',
  DETAIL: 'detail',
  SUGGESTIONS: 'suggestions',
  ADDED: 'added',
  KNOWN: 'known',
  IMPORTED: 'imported',
  TRANSLATED: 'translated',
  SIGNED_IN: 'signedIn',
} as const;

export type Msg =
  | { kind: typeof MSG_KIND.RESOLVE; word: string }
  | { kind: typeof MSG_KIND.DETAIL; lemma_uuid: string }
  | { kind: typeof MSG_KIND.SEARCH; query: string }
  | {
      kind: typeof MSG_KIND.ADD;
      lemma_uuid: string;
      context?: LemmaContext;
    }
  | { kind: typeof MSG_KIND.KNOW; lemma_uuid: string }
  | {
      kind: typeof MSG_KIND.IMPORT_PAGE;
      title: string;
      source_url: string;
      text: string;
    }
  | { kind: typeof MSG_KIND.TRANSLATE; text: string }
  | { kind: typeof MSG_KIND.SIGN_IN };

export type MsgResult =
  | { ok: true; kind: typeof MSG_RESULT_KIND.RESOLVE; data: ResolveResponse }
  | {
      ok: true;
      kind: typeof MSG_RESULT_KIND.DETAIL;
      data: LemmaDefinitionsResponse;
    }
  | { ok: true; kind: typeof MSG_RESULT_KIND.SUGGESTIONS; data: string[] }
  | { ok: true; kind: typeof MSG_RESULT_KIND.ADDED }
  | { ok: true; kind: typeof MSG_RESULT_KIND.KNOWN }
  | { ok: true; kind: typeof MSG_RESULT_KIND.IMPORTED }
  | {
      ok: true;
      kind: typeof MSG_RESULT_KIND.TRANSLATED;
      data: TranslationResponse;
    }
  | { ok: true; kind: typeof MSG_RESULT_KIND.SIGNED_IN }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'too-large'
        | 'invalid-page'
        | 'quota-reached'
        | 'network'
        | 'unknown';
    };

// chrome.runtime.sendMessage's generics default to `any` - an unpinned call site isn't
// checked against Msg/MsgResult at all, so a typo'd kind string compiles silently and only
// fails at runtime. Route every call through here so the compiler catches it instead.
export function sendMessage(msg: Msg): Promise<MsgResult> {
  return chrome.runtime.sendMessage<Msg, MsgResult>(msg);
}

// Service-worker → content-script commands (fire-and-forget, no response).
export const TAB_CMD = {
  SHOW_FOR: 'showFor',
  SHOW_TRANSLATION: 'showTranslation',
  RUN_IMPORT: 'runImport',
  PING: 'ping',
} as const;

export type TabCommand =
  | { kind: typeof TAB_CMD.SHOW_FOR; word: string }
  | { kind: typeof TAB_CMD.SHOW_TRANSLATION; text: string }
  | { kind: typeof TAB_CMD.RUN_IMPORT }
  | { kind: typeof TAB_CMD.PING };

// Typed, and swallows the rejection Chrome raises when the target tab has no
// content-script receiver (restricted pages, tabs older than the install).
export function sendTabCommand(tabId: number, cmd: TabCommand): void {
  void chrome.tabs.sendMessage(tabId, cmd).catch(() => {});
}
