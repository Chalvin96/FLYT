import { createContext } from 'react';

export type LookupMode = 'lemma' | 'search';

export interface LemmaTarget {
  wordText: string;
  lemmaUuid: string | null;
}

export interface LookupState {
  isOpen: boolean;
  mode: LookupMode;
  lemmaTarget: LemmaTarget | null;
  priorQuery: string | null;
  searchQuery: string;
}

export interface LookupContextValue extends LookupState {
  openLemma(lemmaUuid: string | null, wordText: string): void;
  openSearch(query?: string): void;
  switchToLemma(lemmaUuid: string | null, wordText: string): void;
  switchToSearch(): void;
  close(): void;
  setSearchQuery(query: string): void;
}

export const initialLookupState: LookupState = {
  isOpen: false,
  mode: 'search',
  lemmaTarget: null,
  priorQuery: null,
  searchQuery: '',
};

export const lookupContext = createContext<LookupContextValue | null>(null);
