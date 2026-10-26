import type { Ref } from "react";

import { ResultView } from "./LemmaResults";
import { SignInPrompt } from "./PopupActions";
import { LookupError } from "./PopupError";
import { LoadingView } from "./PopupLoading";
import { SearchView } from "./SearchView";
import type { View } from "./popupView";
import type { useLemmaCandidates } from "./useLemmaCandidates";

export function PopupBody({
  view,
  candidates,
  searchInput,
  onResolveWord,
}: {
  view: View;
  candidates: ReturnType<typeof useLemmaCandidates>;
  searchInput: Ref<HTMLInputElement>;
  onResolveWord: (word: string) => void;
}) {
  switch (view.kind) {
    case "result":
      return (
        <ResultView
          candidates={candidates}
          onResolveWord={onResolveWord}
          res={view.res}
        />
      );
    case "loading":
      return <LoadingView word={view.word} />;
    case "search":
      return (
        <SearchView
          initialQuery={view.query}
          inputRef={searchInput}
          onResolveWord={onResolveWord}
        />
      );
    case "signIn":
      return <SignInPrompt />;
    case "error":
      return (
        <LookupError
          failure={{
            ok: false,
            error: view.error ?? "unknown",
            message: view.message,
          }}
          word={view.word}
        />
      );
    case "selection":
      return null;
  }
}
