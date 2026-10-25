import { useRef, useState, type Ref } from "react";
import { SearchBar } from "@flyt/lexicon";
import { buildHeadwordForms } from "@flyt/lexicon/grammar";
import { Button } from "@flyt/ui";

import { MSG_KIND, MSG_RESULT_KIND, sendMessage } from "../lib/messages";

export function SearchView({
  inputRef,
  initialQuery,
  onResolveWord,
}: {
  inputRef: Ref<HTMLInputElement>;
  initialQuery: string;
  onResolveWord: (word: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const suggestionRequestRef = useRef(0);

  const handleSearch = async (nextQuery: string) => {
    const requestId = ++suggestionRequestRef.current;
    if (nextQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await sendMessage({
        kind: MSG_KIND.SEARCH,
        query: nextQuery,
      });
      if (requestId !== suggestionRequestRef.current) return;
      setSuggestions(
        result.ok && result.kind === MSG_RESULT_KIND.SUGGESTIONS
          ? result.data
          : [],
      );
    } catch {
      if (requestId === suggestionRequestRef.current) setSuggestions([]);
    } finally {
      if (requestId === suggestionRequestRef.current) setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-3">
      <SearchBar
        ref={inputRef}
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        isLoading={isLoading}
        placeholder="Search Norwegian"
      />
      {suggestions.length > 0 && (
        <ul
          role="list"
          className="m-0 mt-1 flex max-h-55 list-none flex-col gap-1 overflow-y-auto p-0"
        >
          {suggestions.map((label, index) => {
            const forms = buildHeadwordForms(label);
            return (
              <li key={label + "-" + index}>
                <Button
                  variant="ghost"
                  align="start"
                  width="full"
                  size="sm"
                  aria-label={forms.canonical}
                  onClick={() => onResolveWord(forms.canonical)}
                >
                  {forms.display}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
