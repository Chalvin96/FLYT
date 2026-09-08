import { useCallback, useEffect, useMemo, useState } from 'react';

import { K_LEXICON_SUGGEST_QUERY_MIN_LENGTH } from '@/api/lexicon.constants';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { useBrowseSuggestions } from '@/hooks/lexicon/queries';
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue';
import { hasValidNorwegianChars } from '@/utils/validation';

const INVALID_QUERY_MESSAGE =
  'Please use letters only. Norwegian letters like ae, oe, and aa are supported.';
const LISTBOX_ID = 'search-suggestions-listbox';

export function useDictionaryLookup() {
  const { searchQuery, setSearchQuery, switchToLemma } = useLookupContext();

  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [preferKeyboardHighlight, setPreferKeyboardHighlight] = useState(false);

  const normalizedQuery = searchQuery.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 250);
  const isQueryValid =
    normalizedQuery.length === 0 || hasValidNorwegianChars(normalizedQuery);
  const canShowSuggestions =
    isQueryValid &&
    normalizedQuery.length >= K_LEXICON_SUGGEST_QUERY_MIN_LENGTH;

  const suggestionsQuery = useBrowseSuggestions(
    isQueryValid ? debouncedQuery : '',
  );
  const suggestions = suggestionsQuery.data?.suggestions ?? [];

  // Reset highlights when suggestions availability changes
  useEffect(() => {
    if (!canShowSuggestions) {
      // React 18 automatically batches these updates within effects
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsSuggestionsOpen(false);
      setHighlightedIndex(0);
      setHoveredIndex(-1);
      setPreferKeyboardHighlight(false);
      return;
    }

    setHighlightedIndex((current) => {
      if (suggestions.length === 0) {
        return 0;
      }
      return Math.min(current, suggestions.length - 1);
    });
  }, [canShowSuggestions, suggestions.length]);

  const topSuggestion = suggestions[highlightedIndex] ?? suggestions[0] ?? null;
  const activeHighlightIndex =
    preferKeyboardHighlight || hoveredIndex < 0
      ? highlightedIndex
      : hoveredIndex;

  const highlightedOptionId =
    activeHighlightIndex >= 0 && isSuggestionsOpen && suggestions.length > 0
      ? `suggestion-option-${activeHighlightIndex}`
      : undefined;

  const commitSelection = useCallback(
    (headword: string) => {
      setIsSuggestionsOpen(false);
      setHighlightedIndex(0);
      setHoveredIndex(-1);
      setPreferKeyboardHighlight(false);
      switchToLemma(null, headword);
    },
    [switchToLemma],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSuggestionsOpen(false);
    setHighlightedIndex(0);
    setHoveredIndex(-1);
    setPreferKeyboardHighlight(false);
  }, [setSearchQuery]);

  const handleInputChange = useCallback(
    (nextValue: string) => {
      setSearchQuery(nextValue);
      setIsSuggestionsOpen(
        nextValue.trim().length >= K_LEXICON_SUGGEST_QUERY_MIN_LENGTH,
      );
      setHoveredIndex(-1);
      setPreferKeyboardHighlight(false);
    },
    [setSearchQuery],
  );

  const handleInputFocus = useCallback(() => {
    if (canShowSuggestions) {
      setIsSuggestionsOpen(true);
    }
  }, [canShowSuggestions]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' && canShowSuggestions) {
        event.preventDefault();
        setHoveredIndex(-1);
        setPreferKeyboardHighlight(true);

        if (!isSuggestionsOpen) {
          setIsSuggestionsOpen(true);
          setHighlightedIndex(0);
        } else {
          setHighlightedIndex((current) => {
            if (suggestions.length === 0) {
              return 0;
            }
            return Math.min(current + 1, suggestions.length - 1);
          });
        }
      }

      if (
        event.key === 'ArrowUp' &&
        isSuggestionsOpen &&
        suggestions.length > 0
      ) {
        event.preventDefault();
        setHoveredIndex(-1);
        setPreferKeyboardHighlight(true);
        setHighlightedIndex((current) => Math.max(current - 1, 0));
      }

      // Escape is handled at the Dialog Content level (LookupSheet's
      // onEscapeKeyDown): Radix listens for Escape at the document level, so an
      // input handler cannot reliably intercept it to close only the dropdown.

      if (event.key === 'Enter') {
        if (!topSuggestion || debouncedQuery !== normalizedQuery) {
          return;
        }
        event.preventDefault();
        commitSelection(topSuggestion.label);
      }
    },
    [
      canShowSuggestions,
      commitSelection,
      debouncedQuery,
      isSuggestionsOpen,
      normalizedQuery,
      suggestions.length,
      topSuggestion,
    ],
  );

  const ariaBundle = useMemo(
    () => ({
      role: 'combobox' as const,
      'aria-autocomplete': 'list' as const,
      'aria-expanded': isSuggestionsOpen && canShowSuggestions,
      'aria-controls': LISTBOX_ID,
      'aria-activedescendant': highlightedOptionId,
    }),
    [isSuggestionsOpen, canShowSuggestions, highlightedOptionId],
  );

  return {
    // State
    query: searchQuery,
    setQuery: setSearchQuery,
    normalizedQuery,
    debouncedQuery,
    isQueryValid,
    canShowSuggestions,
    isSuggestionsOpen,
    setIsSuggestionsOpen,
    highlightedIndex,
    setHighlightedIndex,
    hoveredIndex,
    setHoveredIndex,
    preferKeyboardHighlight,
    setPreferKeyboardHighlight,
    activeHighlightIndex,

    // Suggestions
    suggestions,
    suggestionsQuery,
    topSuggestion,

    // Handlers
    handleInputChange,
    handleInputFocus,
    handleKeyDown,
    commitSelection,
    clearSearch,

    // Aria
    ariaBundle,
    highlightedOptionId,

    // Constants
    INVALID_QUERY_MESSAGE,
    LISTBOX_ID,
  };
}
