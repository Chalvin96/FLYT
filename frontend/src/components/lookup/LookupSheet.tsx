import { buildHeadwordForms } from '@flyt/lexicon/grammar';
import {
  BottomSheetDialogContent,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Row,
  Skeleton,
  Text,
  textVariants,
} from '@flyt/ui';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

import {
  useBrowseHeadword,
  useLemmaDefinitions,
} from '@/hooks/lexicon/queries';
import { useCommandShortcut } from '@/hooks/lookup/useCommandShortcut';
import { useDictionaryLookup } from '@/hooks/lookup/useDictionaryLookup';
import { useIsDesktop } from '@/hooks/ui/useIsDesktop';

import { HomographCard, LemmaCardSkeleton } from './HomographCard';
import { useLookupContext } from './useLookupContext';

interface DropdownEscapeBridge {
  isOpen: boolean;
  close: () => void;
}

const K_LOOKUP_QUERY_ERROR_ID = 'lookup-query-error';

export function LookupSheet({
  readerOwnsLemma = false,
}: {
  readerOwnsLemma?: boolean;
}) {
  useCommandShortcut();
  const ctx = useLookupContext();
  const isDesktop = useIsDesktop();

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
  if (ctx.mode === 'lemma' && readerOwnsLemma) return null;

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
          anchor="centered"
          layout="column"
          onEscapeKeyDown={handleEscapeKeyDown}
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
    <DialogContent
      onEscapeKeyDown={onEscapeKeyDown}
      overlayPresentation="clear"
      padding="none"
      showClose={false}
      variant="anchored"
    >
      {children}
    </DialogContent>
  );
}

function LemmaSheetContent() {
  const { lemmaTarget, priorQuery, switchToSearch, openSearch } =
    useLookupContext();
  const containerRef = useRef<HTMLDivElement>(null);

  // On a search→lemma swap the combobox unmounts inside the still-open dialog,
  // so focus needs an explicit target; a fresh open leaves it to Radix.
  useEffect(() => {
    if (priorQuery) containerRef.current?.focus();
  }, [priorQuery]);

  const isBrowseMode = lemmaTarget?.lemmaUuid === null;
  const browseQuery = useBrowseHeadword(
    isBrowseMode ? (lemmaTarget?.wordText ?? '') : '',
  );
  const detailQuery = useLemmaDefinitions(
    isBrowseMode ? null : (lemmaTarget?.lemmaUuid ?? null),
  );
  const learnerWord =
    detailQuery.data?.lemma.primary_display_form ??
    browseQuery.data?.entries[0]?.label ??
    lemmaTarget?.wordText ??
    '';

  const isBrowseFailed =
    isBrowseMode &&
    browseQuery.isFetched &&
    (browseQuery.data?.entries.length ?? 0) === 0;

  if (!lemmaTarget) return null;

  const entries = isBrowseMode ? (browseQuery.data?.entries ?? []) : [];
  const handleBack = () => (priorQuery ? switchToSearch() : openSearch(''));

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      data-testid="lemma-content"
      aria-label={`Dictionary entry for ${learnerWord}`}
      className="flex flex-col min-h-0 outline-none"
    >
      <LemmaSheetHeader onBack={handleBack} priorQuery={priorQuery} />

      <DialogTitle visuallyHidden>{learnerWord}</DialogTitle>
      <DialogDescription visuallyHidden>
        Dictionary entry for {learnerWord}
      </DialogDescription>

      <div
        className="overflow-y-auto flex-1 min-h-0 px-5 py-4"
        aria-live="polite"
        aria-busy={isBrowseMode ? browseQuery.isPending : false}
      >
        <LemmaSheetBody
          entries={entries}
          isBrowseFailed={isBrowseFailed}
          isBrowseMode={isBrowseMode}
          lemmaUuid={lemmaTarget.lemmaUuid}
          onSearchAgain={handleBack}
        />
      </div>
    </div>
  );
}

function LemmaSheetHeader({
  onBack,
  priorQuery,
}: {
  onBack: () => void;
  priorQuery: string | null;
}) {
  return (
    <div className="shrink-0 px-5 pt-4 pb-3 border-b border-default bg-raised flex items-center justify-between">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Button onClick={onBack} variant="link">
                {priorQuery ? (
                  <span className="truncate">← &quot;{priorQuery}&quot;</span>
                ) : (
                  <span>← Back to search</span>
                )}
              </Button>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <DialogClose asChild>
        <Button aria-label="Close" shape="pill" size="icon-sm" variant="ghost">
          <X className="icon-sm" />
        </Button>
      </DialogClose>
    </div>
  );
}

function LemmaSheetBody({
  entries,
  isBrowseFailed,
  isBrowseMode,
  lemmaUuid,
  onSearchAgain,
}: {
  entries: { uuid: string }[];
  isBrowseFailed: boolean;
  isBrowseMode: boolean;
  lemmaUuid: string | null;
  onSearchAgain: () => void;
}) {
  if (isBrowseFailed) {
    return <BrowseFailedNotice onSearchAgain={onSearchAgain} />;
  }
  if (!isBrowseMode) {
    return lemmaUuid ? <HomographCard lemmaUuid={lemmaUuid} /> : null;
  }
  return entries.length > 0 ? (
    <div className="space-y-4">
      {entries.map((entry) => (
        <HomographCard key={entry.uuid} lemmaUuid={entry.uuid} />
      ))}
    </div>
  ) : (
    <LemmaCardSkeleton />
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
  const queryForms = buildHeadwordForms(search.normalizedQuery);

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
      <DialogTitle visuallyHidden>Dictionary search</DialogTitle>
      <DialogDescription visuallyHidden>
        Search the Norwegian dictionary
      </DialogDescription>

      <div className="sticky top-0 z-10 border-b border-default bg-raised px-5 py-4 shrink-0">
        <div className="relative flex items-center h-9 radius-field border border-default bg-overlay">
          <Search className="icon-sm absolute left-3 text-subtle pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search a Norwegian word"
            value={search.query}
            onChange={(e) => search.handleInputChange(e.target.value)}
            onFocus={search.handleInputFocus}
            onKeyDown={search.handleKeyDown}
            aria-invalid={
              search.query.length > 0 && !search.isQueryValid ? true : undefined
            }
            aria-describedby={
              search.query.length > 0 && !search.isQueryValid
                ? K_LOOKUP_QUERY_ERROR_ID
                : undefined
            }
            className={`h-full w-full bg-transparent pl-10 pr-12 outline-none placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--border-focused)] ${textVariants({ size: 'medium' })}`}
            {...search.ariaBundle}
          />
          {search.query.length > 0 && (
            <span className="absolute right-1 flex">
              <Button
                aria-label="Clear search"
                onClick={() => {
                  search.clearSearch();
                  inputRef.current?.focus();
                }}
                shape="pill"
                size="icon-sm"
                variant="ghost"
              >
                <X />
              </Button>
            </span>
          )}
        </div>

        {!search.isQueryValid && search.query.length > 0 && (
          <div id={K_LOOKUP_QUERY_ERROR_ID} role="alert" className="mt-2">
            <Text as="p" size="small" tone="danger">
              {search.INVALID_QUERY_MESSAGE}
            </Text>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4">
        {!shouldShowDropdown ? (
          <div className="italic">
            <Text as="div" size="medium" tone="subtle">
              Type at least 2 characters to search
            </Text>
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
            className="space-y-2 text-subtle"
          >
            {search.suggestions.map((suggestion, index) => {
              const isHighlighted = index === search.activeHighlightIndex;
              const forms = buildHeadwordForms(suggestion.label);
              return (
                <Row
                  key={suggestion.label}
                  id={`suggestion-option-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  ref={isHighlighted ? highlightedOptionRef : undefined}
                  size="sm"
                  selected={isHighlighted}
                  onMouseMove={() => {
                    search.setPreferKeyboardHighlight(false);
                    search.setHoveredIndex(index);
                    search.setHighlightedIndex(index);
                  }}
                  onMouseLeave={() => {
                    search.setHoveredIndex(-1);
                  }}
                  onClick={() => search.commitSelection(forms.canonical)}
                  aria-label={forms.canonical}
                >
                  <span className="block">
                    <Text as="span" size="medium">
                      {renderMatchedPrefix(forms.display, queryForms.display)}
                    </Text>
                  </span>
                  {(suggestion.alternative_forms?.length ?? 0) > 0 && (
                    <span className="block text-subtle">
                      <Text as="span" size="small">
                        {suggestion.alternative_forms?.join(' · ')}
                      </Text>
                    </span>
                  )}
                </Row>
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
      <div className="w-full max-w-48">
        <Skeleton data-slot="skeleton" />
      </div>
    </div>
  ));
}

function renderEmptySuggestionsRow() {
  return (
    <div
      className="flex min-h-[7.5rem] items-center px-4 italic text-subtle"
      role="presentation"
    >
      <Text as="div" size="medium">
        No matches
      </Text>
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
      <Text as="span" weight="semibold">
        {label.slice(0, prefixLength)}
      </Text>
      {label.slice(prefixLength)}
    </>
  );
}

function BrowseFailedNotice({ onSearchAgain }: { onSearchAgain: () => void }) {
  return (
    <div className="space-y-3 p-4">
      <Text as="div" size="medium" tone="subtle">
        <p>No definition found for this word.</p>
        <Button onClick={onSearchAgain} variant="link">
          Search for something else
        </Button>
      </Text>
    </div>
  );
}
