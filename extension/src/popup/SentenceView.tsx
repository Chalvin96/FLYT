import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { InlineTrigger, Skeleton, Text } from "@flyt/ui";

import { ClampedText } from "./ClampedText";
import { ErrorActions, ErrorMessage } from "./PopupError";
import { useSelectionTranslation } from "./useSelectionTranslation";
import { selectionWord } from "../lib/selectionWord";
import { capTranslationSelection } from "../lib/capTranslationSelection";
import type { LemmaContext } from "../lib/messages";
import type { TokenIdentity } from "./usePopupWordLookup";
import type { PopupFailure } from "./buildPopupError";

export type SentenceViewHandle = {
  focusToken: (token: TokenIdentity) => void;
  retryTranslation: () => void;
};

export function SentenceView({
  selection,
  text,
  activeToken,
  onResolveWord,
  ref,
  onTranslationError,
  separateActions = false,
}: {
  selection: LemmaContext;
  text?: string;
  activeToken?: TokenIdentity;
  onResolveWord: (word: string, occurrence: number) => void;
  ref?: Ref<SentenceViewHandle>;
  onTranslationError?: (failure: PopupFailure | null) => void;
  separateActions?: boolean;
}) {
  const sourceText = text ?? selection.source_sentence;
  const capped = useMemo(() => capTranslationSelection(sourceText), [sourceText]);
  const translation = useSelectionTranslation(capped.text, onTranslationError);
  const tokens = useRef(new Map<string, HTMLButtonElement>());
  useImperativeHandle(ref, () => ({
    focusToken: (token) => tokens.current.get(buildTokenKey(token))?.focus(),
    retryTranslation: translation.retry,
  }));

  const counts = new Map<string, number>();
  const source = capped.text.split(/(\s+)/u).map((token) => {
    const word = selectionWord(token);
    const counted = word ?? token;
    const occurrence = counts.get(counted) ?? 0;
    counts.set(counted, occurrence + 1);
    const key = `${counted}-${occurrence}`;
    if (!word) return <span key={key}>{token}</span>;
    const start = token.indexOf(word);
    return (
      <span key={key} className="whitespace-nowrap">
        {token.slice(0, start)}
        <InlineTrigger
          current={
            activeToken?.word === word && activeToken.occurrence === occurrence
          }
          onClick={() => onResolveWord(word, occurrence)}
          ref={(element) => {
            if (element) tokens.current.set(key, element);
            else tokens.current.delete(key);
          }}
        >
          {word}
        </InlineTrigger>
        {token.slice(start + word.length)}
      </span>
    );
  });

  return (
    <section aria-label="Sentence translation">
      <div className="space-y-2.5 bg-neutral-subtle px-4 py-4">
        <div className="space-y-1">
          <Text size="medium" weight="semibold">
            Selected text
          </Text>
          {selection.source_title && (
            <div className="truncate" title={selection.source_title}>
              <Text size="small" tone="subtle">
                From: {selection.source_title}
              </Text>
            </div>
          )}
        </div>
        <ClampedText key={capped.text} label="selected text">
          <Text lang="nb" size="large" tone="default">
            {source}
          </Text>
        </ClampedText>
        {capped.notice && (
          <Text size="small" tone="subtle">
            {capped.notice}
          </Text>
        )}
        {translation.state.kind === "success" && (
          <ClampedText key={translation.state.text} label="translation">
            <Text lang="en" size="medium" tone="subtle">
              {translation.state.text}
            </Text>
          </ClampedText>
        )}
        {translation.state.kind === "loading" && (
          <div
            role="status"
            aria-label="Translating selected text"
            aria-busy="true"
          >
            <span className="sr-only">Translating…</span>
            <Skeleton length="long" />
          </div>
        )}
      </div>
      {translation.state.kind === "error" && (
        <>
          <ErrorMessage failure={translation.state.failure} />
          {!separateActions && (
            <ErrorActions
              failure={translation.state.failure}
              onRetry={translation.retry}
            />
          )}
        </>
      )}
    </section>
  );
}

function buildTokenKey(token: TokenIdentity) {
  return `${token.word}-${token.occurrence}`;
}
