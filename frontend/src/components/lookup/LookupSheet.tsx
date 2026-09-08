import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useMatch } from '@tanstack/react-router';

import { BottomSheetDialogContent } from '@/components/common/BottomSheetDialogContent/BottomSheetDialogContent';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrowseHeadword } from '@/hooks/lexicon/queries';
import { useCommandShortcut } from '@/hooks/lookup/useCommandShortcut';
import { useDictionaryLookup } from '@/hooks/lookup/useDictionaryLookup';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';
import { cn } from '@/lib/utils';

import { HomographCard, LemmaCardSkeleton } from './HomographCard';
import { useLookupContext } from './useLookupContext';

interface DropdownEscapeBridge {
  isOpen: boolean;
  close: () => void;
}

export function LookupSheet() {
  useCommandShortcut();
  const ctx = useLookupContext();
  const isDesktop = useIsDesktop();
  // Truthy only on the story-reader leaf route (the `_reader` layout renders a
  // side panel that owns lemma content there). `useMatch` is type-checked
  // against the generated route tree, so a route rename fails at compile.
  const readerMatch = useMatch({
    from: '/_reader/reading/story/$uuid',
    shouldThrow: false,
  });

  const dropdownBridge = useRef<DropdownEscapeBridge>({
    isOpen: false,
    close: () => {},
  });
  const registerDropdown = useCallback((state: DropdownEscapeBridge) => {
    dropdownBridge.current = state;
  }, []);

  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    if (dropdownBridge.current.isOpen) {
      event.preventDefault();
      dropdownBridge.current.close();
    }
  }, []);

  if (!ctx.isOpen) return null;
  // On the desktop reader, lemma mode is handled by the side panel — don't
  // render a modal. Everywhere else the lookup renders its own surface.
  if (isDesktop && readerMatch && ctx.mode === 'lemma') return null;

  // Desktop (non-reader): search AND lemma share ONE top-anchored popover
  // fixed under the navbar search entry. Swapping content in place (instead
  // of dropping the result into a separate bottom sheet) keeps the search
  // input and its result visually connected — the back affordance returns to
  // the exact surface the user typed into (Spotlight / Cmd+K mental model).
  const useAnchoredPopover = isDesktop;

  const content =
    ctx.mode === 'lemma' ? (
      <LemmaSheetContent />
    ) : (
      <SearchSheetContent registerDropdown={registerDropdown} />
    );

  return (
    <Dialog
      open={ctx.isOpen}
      onOpenChange={(open) => {
        if (!open) ctx.close();
      }}
    >
      {useAnchoredPopover ? (
        <AnchoredLookupContent onEscapeKeyDown={handleEscapeKeyDown}>
          {content}
        </AnchoredLookupContent>
      ) : (
        <BottomSheetDialogContent
          onEscapeKeyDown={handleEscapeKeyDown}
          className="!flex !flex-col max-w-[var(--dialog-desktop-max-width)] px-0
                     sm:left-1/2 sm:right-auto
                     sm:w-[min(var(--dialog-desktop-max-width),calc(100%-3rem))]
                     sm:-translate-x-1/2"
        >
          {content}
        </BottomSheetDialogContent>
      )}
    </Dialog>
  );
}

function AnchoredLookupContent({
  onEscapeKeyDown,
  children,
}: {
  onEscapeKeyDown: (event: KeyboardEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPortal>
      <DialogOverlay className="bg-transparent" />
      <DialogPrimitive.Content
        onEscapeKeyDown={onEscapeKeyDown}
        className={cn(
          'fixed left-1/2 top-20 z-50 -translate-x-1/2',
          'w-[min(var(--dialog-desktop-max-width),calc(100%-3rem))]',
          'max-h-[var(--sheet-max-height-tall)]',
          'radius-field overflow-hidden border border-border bg-card text-card-foreground shadow-lg',
          'outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          'data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4',
          'duration-200',
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function LemmaSheetContent() {
  const { lemmaTarget, priorQuery, switchToSearch, openSearch } =
    useLookupContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // Move focus into the lemma view only when arriving via a search→lemma swap
  // (priorQuery set). In that case the combobox just unmounted inside the same
  // open dialog, so focus would fall out without an explicit target. On a fresh
  // open (direct word-tap / browse, priorQuery null) let Radix's dialog focus
  // handling run instead — this also keeps mobile bottom-sheet behavior intact.
  useEffect(() => {
    if (priorQuery) containerRef.current?.focus();
  }, [priorQuery]);

  const isBrowseMode = lemmaTarget?.lemmaUuid === null;
  const browseQuery = useBrowseHeadword(
    isBrowseMode ? (lemmaTarget?.wordText ?? '') : '',
  );

  const isBrowseFailed =
    isBrowseMode &&
    browseQuery.isFetched &&
    (browseQuery.data?.entries.length ?? 0) === 0;

  if (!lemmaTarget) return null;

  const entries = isBrowseMode ? (browseQuery.data?.entries ?? []) : [];
  const isLoadingEntries = isBrowseMode ? browseQuery.isPending : false;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      data-testid="lemma-content"
      aria-label={`Dictionary entry for ${lemmaTarget.wordText}`}
      className="flex flex-col min-h-0 outline-none"
    >
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border bg-card flex items-center justify-between">
        <button
          type="button"
          onClick={() => (priorQuery ? switchToSearch() : openSearch(''))}
          className="cursor-pointer type-caption text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 min-w-0"
        >
          {priorQuery ? (
            <span className="truncate">← &quot;{priorQuery}&quot;</span>
          ) : (
            <span>← Back to search</span>
          )}
        </button>
        <DialogPrimitive.Close className="ml-3 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary-10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <X className="icon-sm" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>

      <DialogTitle className="sr-only">{lemmaTarget.wordText}</DialogTitle>
      <DialogDescription className="sr-only">
        Dictionary entry for {lemmaTarget.wordText}
      </DialogDescription>

      <div
        className="overflow-y-auto flex-1 min-h-0 px-5 py-4"
        aria-live="polite"
        aria-busy={isLoadingEntries}
      >
        {isBrowseFailed ? (
          <BrowseFailedNotice
            onSearchAgain={() =>
              priorQuery ? switchToSearch() : openSearch('')
            }
          />
        ) : isBrowseMode ? (
          entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry) => (
                <HomographCard key={entry.uuid} lemmaUuid={entry.uuid} />
              ))}
            </div>
          ) : (
            <LemmaCardSkeleton />
          )
        ) : lemmaTarget.lemmaUuid ? (
          <HomographCard lemmaUuid={lemmaTarget.lemmaUuid} />
        ) : null}
      </div>
    </div>
  );
}

function SearchSheetContent({
  registerDropdown,
}: {
  registerDropdown: (state: DropdownEscapeBridge) => void;
}) {
  const search = useDictionaryLookup();
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightedOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (highlightedOptionRef.current) {
      highlightedOptionRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [search.highlightedIndex, search.isSuggestionsOpen]);

  const shouldShowDropdown =
    search.isSuggestionsOpen && search.canShowSuggestions;

  const { setIsSuggestionsOpen } = search;
  useEffect(() => {
    registerDropdown({
      isOpen: shouldShowDropdown,
      close: () => setIsSuggestionsOpen(false),
    });
    return () => registerDropdown({ isOpen: false, close: () => {} });
  }, [registerDropdown, shouldShowDropdown, setIsSuggestionsOpen]);

  return (
    <div className="flex flex-col h-full">
      <DialogTitle className="sr-only">Dictionary search</DialogTitle>
      <DialogDescription className="sr-only">
        Search the Norwegian dictionary
      </DialogDescription>

      <div className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4 shrink-0">
        <div className="relative flex items-center h-9 radius-field border border-secondary-20 bg-white-100">
          <Search className="icon-sm absolute left-3 text-secondary-60 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search a Norwegian word"
            value={search.query}
            onChange={(e) => search.handleInputChange(e.target.value)}
            onFocus={search.handleInputFocus}
            onKeyDown={search.handleKeyDown}
            className={cn(
              'h-full w-full bg-transparent pl-10 pr-9 type-caption outline-none placeholder:text-muted-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-40',
            )}
            {...search.ariaBundle}
          />
          {search.query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                search.clearSearch();
                inputRef.current?.focus();
              }}
              className="absolute right-2 flex size-6 items-center justify-center text-secondary-60 hover:text-secondary-80"
              aria-label="Clear search"
            >
              <X className="icon-sm" />
            </button>
          )}
        </div>

        {!search.isQueryValid && search.normalizedQuery.length > 0 && (
          <p className="type-caption-sm text-destructive-60 mt-2">
            {search.INVALID_QUERY_MESSAGE}
          </p>
        )}
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4">
        {!shouldShowDropdown ? (
          <div className="type-caption text-muted-foreground italic">
            Type at least 2 characters to search
          </div>
        ) : search.suggestionsQuery.isPending ? (
          <div role="status" aria-label="Loading suggestions">
            {renderSuggestionSkeletonRows()}
          </div>
        ) : search.suggestions.length === 0 ? (
          <div role="status">{renderEmptySuggestionsRow()}</div>
        ) : (
          <div
            id={search.LISTBOX_ID}
            role="listbox"
            aria-label="Suggestions"
            className="space-y-2"
          >
            {search.suggestions.map((suggestion, index) => {
              const isHighlighted = index === search.activeHighlightIndex;
              return (
                <button
                  key={suggestion.label}
                  id={`suggestion-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  ref={isHighlighted ? highlightedOptionRef : undefined}
                  className={cn(
                    'flex w-full items-center px-4 h-10 text-left type-caption transition-colors radius-sm',
                    isHighlighted
                      ? 'bg-secondary-10 text-foreground'
                      : 'text-muted-foreground hover:bg-secondary-10 hover:text-foreground',
                  )}
                  onMouseMove={() => {
                    search.setPreferKeyboardHighlight(false);
                    search.setHoveredIndex(index);
                    search.setHighlightedIndex(index);
                  }}
                  onMouseLeave={() => {
                    search.setHoveredIndex(-1);
                  }}
                  onClick={() => search.commitSelection(suggestion.label)}
                >
                  {renderMatchedPrefix(
                    suggestion.label,
                    search.normalizedQuery,
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function renderSuggestionSkeletonRows() {
  return Array.from({ length: 3 }, (_, index) => (
    <div
      key={`suggestion-skeleton-${index}`}
      className="flex items-center px-4 h-10"
      role="presentation"
    >
      <Skeleton className="h-4 w-full max-w-[12rem]" data-slot="skeleton" />
    </div>
  ));
}

function renderEmptySuggestionsRow() {
  return (
    <div
      className="flex min-h-[7.5rem] items-center px-4 type-caption italic text-secondary-60"
      role="presentation"
    >
      No matches
    </div>
  );
}

function renderMatchedPrefix(label: string, query: string) {
  if (!query) {
    return label;
  }

  const prefixLength = Math.min(query.length, label.length);
  const lowerLabel = label.slice(0, prefixLength).toLowerCase();
  const lowerQuery = query.slice(0, prefixLength).toLowerCase();

  if (lowerLabel !== lowerQuery) {
    return label;
  }

  return (
    <>
      <span className="font-semibold">{label.slice(0, prefixLength)}</span>
      {label.slice(prefixLength)}
    </>
  );
}

function BrowseFailedNotice({ onSearchAgain }: { onSearchAgain: () => void }) {
  return (
    <div className="space-y-3 p-4 type-caption text-muted-foreground">
      <p>No definition found for this word.</p>
      <button
        type="button"
        onClick={onSearchAgain}
        className="text-foreground underline hover:no-underline"
      >
        Search for something else
      </button>
    </div>
  );
}
