import { useRef, useState, type Ref } from "react";
import { SearchBar } from "@flyt/lexicon";

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
    <div className="flyt-search">
      <SearchBar
        ref={inputRef}
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        isLoading={isLoading}
        placeholder="Search Norwegian"
      />
      {suggestions.length > 0 && (
        <ul role="list" className="flyt-suggestions">
          {suggestions.map((label, index) => (
            <li key={label + "-" + index}>
              <button
                type="button"
                className="flyt-suggestion"
                onClick={() => onResolveWord(label)}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
