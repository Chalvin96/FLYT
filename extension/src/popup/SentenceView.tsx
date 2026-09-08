import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@flyt/ui";

import { SignInButton } from "./PopupActions";
import { selectionWord } from "../lib/selectionWord";
import { MSG_KIND, MSG_RESULT_KIND, sendMessage, type LemmaContext } from "../lib/messages";

type TranslationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: { translated_text: string } }
  | { kind: "error"; message: string; needsSignIn?: boolean };

export function SentenceView({
  selection,
  text,
  activeWord,
  onResolveWord,
}: {
  selection: LemmaContext;
  text?: string;
  activeWord?: string;
  onResolveWord: (word: string) => void;
}) {
  const sourceText = text ?? selection.source_sentence;
  const [translation, setTranslation] = useState<TranslationState>({
    kind: "idle",
  });
  const requestIdRef = useRef(0);

  const translate = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setTranslation({ kind: "loading" });
    try {
      const result = await sendMessage({
        kind: MSG_KIND.TRANSLATE,
        text: sourceText,
      });
      if (requestId !== requestIdRef.current) return;
      if (result.ok && result.kind === MSG_RESULT_KIND.TRANSLATED) {
        setTranslation({ kind: "success", data: result.data });
      } else if (!result.ok && result.error === "unauthorized") {
        setTranslation({
          kind: "error",
          message: "Sign in to translate selected text.",
          needsSignIn: true,
        });
      } else if (!result.ok && result.error === "quota-reached") {
        setTranslation({
          kind: "error",
          message: "Translation is unavailable right now.",
        });
      } else {
        setTranslation({
          kind: "error",
          message: "Could not translate this selection. Try again.",
        });
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setTranslation({
          kind: "error",
          message: "Could not translate this selection. Try again.",
        });
      }
    }
  }, [sourceText]);

  useEffect(() => {
    void translate();
    return () => {
      requestIdRef.current += 1;
    };
  }, [translate]);

  const renderSource = () => {
    const tokenOccurrences = new Map<string, number>();
    return sourceText.split(/(\s+)/u).map((token) => {
      const occurrence = tokenOccurrences.get(token) ?? 0;
      tokenOccurrences.set(token, occurrence + 1);
      const key = `${token}-${occurrence}`;
      const word = selectionWord(token);
      if (!word) {
        return <span key={key}>{token}</span>;
      }
      const wordStart = token.indexOf(word);
      const prefix = token.slice(0, wordStart);
      const suffix = token.slice(wordStart + word.length);
      return (
        <span key={key}>
          {prefix}
          <button
            type="button"
            className={`flyt-source-word${activeWord === word ? " is-active" : ""}`}
            aria-current={activeWord === word ? "true" : undefined}
            onClick={() => onResolveWord(word)}
          >
            {word}
          </button>
          {suffix}
        </span>
      );
    });
  };

  return (
    <section className="flyt-translation" aria-label="Sentence translation">
      <div className="flyt-translation-heading">
        <span className="flyt-translation-label">Selected text</span>
        {selection.source_title && (
          <span className="flyt-translation-title">{selection.source_title}</span>
        )}
      </div>
      {!text && (
        <p className="flyt-translation-hint">
          Choose a word for its dictionary entry.
        </p>
      )}
      <p className="flyt-source-text" lang="no">
        {renderSource()}
      </p>
      {translation.kind === "success" ? (
        <p className="flyt-translated-text" lang="en">
          {translation.data.translated_text}
        </p>
      ) : null}
      {translation.kind === "loading" ? (
        <p className="flyt-translation-status" role="status">
          Translating…
        </p>
      ) : null}
      {translation.kind === "error" ? (
        <div className="flyt-translation-error" role="alert">
          <span>{translation.message}</span>
          {translation.needsSignIn ? (
            <SignInButton
              onDone={() =>
                setTranslation({
                  kind: "error",
                  message: "Finish sign-in in the Flyt tab, then retry.",
                })
              }
            />
          ) : (
            <Button size="sm" variant="outline" onClick={() => void translate()}>
              Retry
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
