import { useCallback, useEffect, useState } from 'react';

import { readDraft, removeDraft, saveDraft } from './draftStorage';

export type DraftStatus = 'saved' | 'unavailable';

/**
 * Owns the learner's draft text and its device-persistence status.
 * `initialResponse` (lesson restore flow) is persisted eagerly so the
 * draft survives a reload even before the learner types.
 */
export function useWriteResponseState({
  draftKeyValue,
  initialResponse,
}: {
  draftKeyValue: string;
  initialResponse?: string;
}) {
  const [response, setResponse] = useState(
    () => initialResponse ?? readDraft(draftKeyValue) ?? '',
  );
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(() =>
    initialResponse === undefined && readDraft(draftKeyValue) !== null
      ? 'saved'
      : null,
  );

  useEffect(() => {
    if (initialResponse === undefined) return;
    if (initialResponse.trim()) {
      saveDraft(draftKeyValue, initialResponse);
    } else {
      removeDraft(draftKeyValue);
    }
  }, [draftKeyValue, initialResponse]);

  const updateResponse = useCallback(
    (next: string) => {
      setResponse(next);
      if (next.trim()) {
        setDraftStatus(saveDraft(draftKeyValue, next));
        return;
      }
      setDraftStatus(
        removeDraft(draftKeyValue) === 'removed' ? null : 'unavailable',
      );
    },
    [draftKeyValue],
  );

  const clearDraft = useCallback(() => {
    setDraftStatus(
      removeDraft(draftKeyValue) === 'removed' ? null : 'unavailable',
    );
  }, [draftKeyValue]);

  return { clearDraft, draftStatus, response, updateResponse };
}
