import { MSG_KIND, MSG_RESULT_KIND } from "../lib/messages";
import type { Msg, MsgResult } from "../lib/messages";
import type {
  LemmaDefinitionsResponse,
  ResolveResponse,
} from "../lib/resolve-types";
import type { PopupState } from "../popup/Popup";

export const SOURCE_SENTENCE = "Jeg leser en bok hver dag.";
export const SOURCE_TITLE = "På biblioteket";
export const LOOKUP_WORD = "bok";
export const SEARCH_QUERY = "få";
export const LOADING_WORD = "annet";
const PRIMARY_DEFINITION = "trykt eller digitalt verk som er utgitt";
export const PRIMARY_PRONUNCIATION = "buːk";
export const TRANSLATED_TEXT = "I read a book every day.";

const BOOK_UUID = "2f6c1d10-5a37-4c8b-9e21-7b0d4a6f3c58";
const WORKBOOK_UUID = "8d3b7a44-1e02-4f6a-9c55-6a1f2b8e07d3";

const SEE_ALSO = [
  {
    article_id: 42,
    word: "hefte",
    relation: "compare",
    target_lemma_uuid: WORKBOOK_UUID,
  },
];

const RESOLVE_RESPONSE: ResolveResponse = {
  query: LOOKUP_WORD,
  candidates: [
    {
      lemma_uuid: BOOK_UUID,
      word: LOOKUP_WORD,
      pos: "noun",
      hgno: 1,
      state: "new",
      definitions: [
        {
          definition: PRIMARY_DEFINITION,
          translation: "book",
        },
        {
          definition: "hefte med blanke eller linjerte sider",
          translation: "notebook",
        },
      ],
      see_also: SEE_ALSO,
    },
  ],
};

export const EMPTY_RESOLVE_RESPONSE: ResolveResponse = {
  query: "kvakkelutt",
  candidates: [],
};

const LEMMA_DETAIL: LemmaDefinitionsResponse = {
  lemma: {
    uuid: BOOK_UUID,
    word: LOOKUP_WORD,
    pos: "noun",
    primary_translation: "book",
    primary_display_form: "bok",
    alternative_forms: ["boka", "bøker"],
    see_also: SEE_ALSO,
    ipa: "buːk",
    intonation: null,
    ipa_approximate: false,
    audio_url: null,
  },
  definitions: [
    {
      uuid: BOOK_UUID + "-1",
      definition: PRIMARY_DEFINITION,
      translation: "book",
      translation_source: null,
      examples: [{ no: "Jeg leser en bok.", en: "I am reading a book." }],
      userState: "new",
    },
    {
      uuid: BOOK_UUID + "-2",
      definition: "hefte med blanke eller linjerte sider",
      translation: "notebook",
      translation_source: null,
      examples: [{ no: "Skriv det i boken.", en: "Write it in the notebook." }],
      userState: "new",
    },
  ],
};

const SEARCH_SUGGESTIONS = [
  "få [stelle|lage] i stand",
  "bok",
  "bokhandel",
  "bokmål",
];

const TRANSLATION = {
  source_text: SOURCE_SENTENCE,
  translated_text: TRANSLATED_TEXT,
  source_language: "no",
  target_language: "en",
};

export function resolveStubbedMessage(msg: Msg): MsgResult {
  switch (msg.kind) {
    case MSG_KIND.DETAIL:
      return { ok: true, kind: MSG_RESULT_KIND.DETAIL, data: LEMMA_DETAIL };
    case MSG_KIND.SEARCH:
      return {
        ok: true,
        kind: MSG_RESULT_KIND.SUGGESTIONS,
        data: SEARCH_SUGGESTIONS,
      };
    case MSG_KIND.TRANSLATE:
      return { ok: true, kind: MSG_RESULT_KIND.TRANSLATED, data: TRANSLATION };
    case MSG_KIND.RESOLVE:
      return {
        ok: true,
        kind: MSG_RESULT_KIND.RESOLVE,
        data: EMPTY_RESOLVE_RESPONSE,
      };
    default:
      return { ok: false, error: "network" };
  }
}

export const SENTENCE_STATE = {
  kind: "selection",
  selection: {
    source_sentence: SOURCE_SENTENCE,
    source_title: SOURCE_TITLE,
  },
  text: SOURCE_SENTENCE,
} satisfies PopupState;

export const RESULT_STATE = {
  kind: "result",
  res: RESOLVE_RESPONSE,
} satisfies PopupState;

export const EMPTY_RESULT_STATE = {
  kind: "result",
  res: EMPTY_RESOLVE_RESPONSE,
} satisfies PopupState;

export const LOADING_STATE = {
  kind: "loading",
  word: LOADING_WORD,
} satisfies PopupState;
