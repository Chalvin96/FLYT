import { Button, Input, Text } from '@flyt/ui';
import React, { useEffect, useEffectEvent, useState } from 'react';

import { hasValidNorwegianChars, normalizeLookupQuery } from './grammar';

const INVALID_QUERY_MESSAGE =
  'Use letters, numbers, spaces, and dictionary punctuation (maximum 80 characters).';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value,
      onChange,
      onSearch,
      isLoading = false,
      placeholder = 'Search for a word...',
    },
    ref,
  ) => {
    const [debouncedQuery, setDebouncedQuery] = useState(value);
    const searchAfterDebounce = useEffectEvent((query: string) => {
      onSearch(query);
    });

    useEffect(() => {
      const timer = setTimeout(() => {
        if (debouncedQuery !== value) {
          setDebouncedQuery(value);
          if (value.length > 0 && hasValidNorwegianChars(value)) {
            searchAfterDebounce(normalizeLookupQuery(value));
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    }, [value, debouncedQuery]);

    const handleClear = () => {
      onChange('');
      onSearch('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && hasValidNorwegianChars(value)) {
        onSearch(normalizeLookupQuery(value));
      }
      if (e.key === 'Escape') {
        handleClear();
      }
    };

    const clearIcon = (
      <Button
        type="button"
        onClick={handleClear}
        variant="ghost"
        size="icon"
        aria-label="Clear search"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="icon-sm"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      </Button>
    );

    const searchIcon = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    );

    return (
      <div className="w-full">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle">
            {searchIcon}
          </div>
          <Input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Loading...' : placeholder}
            disabled={isLoading}
            aria-invalid={value.length > 0 && !hasValidNorwegianChars(value)}
            aria-describedby={
              value.length > 0 && !hasValidNorwegianChars(value)
                ? 'search-query-error'
                : undefined
            }
            adornments={value.length > 0 ? 'both' : 'leading'}
          />
          {value.length > 0 && (
            <div className="absolute inset-y-0 right-0 flex items-center">
              {clearIcon}
            </div>
          )}
        </div>
        {!hasValidNorwegianChars(value) && value.length > 0 && (
          <p id="search-query-error" role="alert" className="mt-1.5">
            <Text as="span" size="small" tone="danger">
              {INVALID_QUERY_MESSAGE}
            </Text>
          </p>
        )}
      </div>
    );
  },
);

SearchBar.displayName = 'SearchBar';
