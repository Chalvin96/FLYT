import type { Msg, MsgResult } from "../lib/messages";
import type {
  LemmaDefinitionsResponse,
  ResolveCandidate,
} from "../lib/resolve-types";
import type { PopupState } from "../popup/Popup";

export const PAGE_TITLE = "Små øyeblikk i byen";
export const BOOK_SENTENCE = "Jeg leser en bok hver dag.";
export const LONG_SELECTION =
  "Det var fortsatt kjølig, men lyset falt varmt over trærne i parken. Ved fortauet åpnet et lite bakeri dørene for dagen, og noen ventet allerede utenfor. Lukten av nybakt brød fulgte meg videre langs den smale gaten mot torget.";
export const LONG_TRANSLATION =
  "It was still chilly, but the light fell warmly over the trees in the park. By the pavement a small bakery opened its doors for the day, and some people were already waiting outside. The smell of freshly baked bread followed me along the narrow street towards the square.";

const entries: LemmaDefinitionsResponse[] = [
  {
    lemma: {
      uuid: "10000000-0000-4000-8000-000000000001",
      word: "hund",
      pos: "noun",
      primary_translation: "dog",
      alternative_forms: ["hunden", "hunder", "hundene"],
      ipa: "hʉn",
      see_also: [],
    },
    definitions: [
      {
        uuid: "dog-1",
        definition: "dyr med fire ben som bjeffer",
        translation: "A dog (animal with four legs that barks)",
        examples: [{ no: "Jeg har en liten hund.", en: "I have a small dog." }],
        userState: "new",
      },
    ],
  },
  {
    lemma: {
      uuid: "10000000-0000-4000-8000-000000000002",
      word: "tre",
      pos: "noun",
      primary_translation: "tree",
      alternative_forms: ["treet", "trær", "trærne"],
      ipa: "treː",
      see_also: [],
    },
    definitions: [
      {
        uuid: "tree-1",
        definition: "plante med stamme, greiner og blad",
        translation: "a tree",
        examples: [
          {
            no: "Det står et tre i hagen.",
            en: "There is a tree in the garden.",
          },
        ],
        userState: "new",
      },
      {
        uuid: "tree-2",
        definition: "materiale fra stammen til et tre",
        translation: "wood",
        examples: [],
        userState: "new",
      },
    ],
  },
  {
    lemma: {
      uuid: "10000000-0000-4000-8000-000000000003",
      word: "tre",
      pos: "numeral",
      primary_translation: "three",
      see_also: [],
    },
    definitions: [
      {
        uuid: "three-1",
        definition: "tallet 3",
        translation: "three",
        examples: [],
        userState: "new",
      },
    ],
  },
  {
    lemma: {
      uuid: "10000000-0000-4000-8000-000000000004",
      word: "bok",
      pos: "noun",
      primary_translation: "book",
      alternative_forms: ["boken", "bøker", "bøkene"],
      see_also: [],
    },
    definitions: [
      {
        uuid: "book-1",
        definition: "samling av sider med tekst eller bilder",
        translation: "a book",
        examples: [{ no: BOOK_SENTENCE, en: null }],
        userState: "new",
      },
      {
        uuid: "book-2",
        definition: "hefte med blanke sider",
        translation: "notebook",
        examples: [],
        userState: "new",
      },
      {
        uuid: "book-3",
        definition: "del av et større verk",
        translation: "volume",
        examples: [],
        userState: "new",
      },
    ],
  },
  {
    lemma: {
      uuid: "10000000-0000-4000-8000-000000000005",
      word: "bakeri",
      pos: "noun",
      primary_translation: "bakery",
      alternative_forms: ["bakeriet", "bakerier", "bakeriene"],
      see_also: [],
    },
    definitions: [
      {
        uuid: "bakery-1",
        definition: "sted der det blir bakt brød",
        translation: "a bakery",
        examples: [],
        userState: "new",
      },
    ],
  },
];

function candidate(entry: LemmaDefinitionsResponse): ResolveCandidate {
  return {
    lemma_uuid: entry.lemma.uuid,
    word: entry.lemma.word,
    pos: entry.lemma.pos,
    hgno: 1,
    definitions: entry.definitions.map(({ definition, translation }) => ({
      definition,
      translation,
    })),
  };
}

export function resultState(word: string, homographs = false): PopupState {
  const matching = entries.filter((entry) => entry.lemma.word === word);
  return {
    kind: "result",
    res: {
      query: word,
      candidates: (homographs ? matching : matching.slice(0, 1)).map(candidate),
    },
    context: {
      source_sentence: `Jeg ser en ${word}.`,
      source_title: PAGE_TITLE,
    },
  };
}

export function selectionState(text: string): PopupState {
  return {
    kind: "selection",
    selection: { source_sentence: text, source_title: PAGE_TITLE },
    text,
  };
}

export function redesignReply(message: Msg): MsgResult {
  switch (message.kind) {
    case "detail": {
      const entry = entries.find(
        (entry) => entry.lemma.uuid === message.lemma_uuid,
      );
      return entry
        ? { ok: true, kind: "detail", data: entry }
        : { ok: false, error: "unknown" };
    }
    case "resolve":
      return {
        ok: true,
        kind: "resolve",
        data: {
          query: message.word,
          candidates: entries
            .filter((entry) => entry.lemma.word === message.word)
            .map(candidate),
        },
      };
    case "translate":
      return {
        ok: true,
        kind: "translated",
        data: {
          source_text: message.text,
          translated_text:
            message.text === BOOK_SENTENCE
              ? "I read a book every day."
              : LONG_TRANSLATION,
          source_language: "no",
          target_language: "en",
        },
      };
    case "search":
      return { ok: true, kind: "suggestions", data: ["sjø", "sjømat"] };
    case "add":
      return { ok: true, kind: "added" };
    case "know":
      return { ok: true, kind: "known" };
    case "signIn":
      return { ok: true, kind: "signedIn" };
    default:
      return { ok: false, error: "unknown" };
  }
}
