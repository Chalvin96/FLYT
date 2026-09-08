import type { MsgResult } from './messages';

// Status of a whole-page import action, shared by the popup footer and the
// context-menu toast. `idle` is popup-only (its button's resting state).
export type ImportActionStatus =
  | { kind: 'importing' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

// User-facing copy for a failed import, keyed off the classified error kind.
export function importErrorMessage(result: MsgResult): string {
  if (result.ok) return 'Could not import this page.';
  switch (result.error) {
    case 'too-large':
      return 'This page is too large to import.';
    case 'invalid-page':
      return 'This page does not contain readable text that Flyt can import.';
    case 'quota-reached':
      return 'Import limit reached. Your existing imports stay available.';
    case 'unauthorized':
      return 'Sign in to Flyt in the tab we opened, then try again.';
    case 'network':
      return 'Could not reach Flyt. Check your connection and try again.';
    case 'unknown':
      return 'Something went wrong importing this page. Try again.';
  }
}
