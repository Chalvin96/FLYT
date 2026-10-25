import { useCallback, useEffect, useState } from 'react';

import {
  readDraftMigratingLegacy,
  removeDraftAndLegacy,
  saveDraft,
} from './draftStorage';

export type DraftStatus = 'saved' | 'unavailable';

export function useWriteResponseState({
  draftKeyValue,
  legacyDraftKeyValue,
  initialResponse,
}: {
  draftKeyValue: string;
  legacyDraftKeyValue?: string;
  initialResponse?: string;
}) {
  const [savedDraft] = useState(() =>
    initialResponse === undefined
      ? readDraftMigratingLegacy(draftKeyValue, legacyDraftKeyValue)
      : null,
  );
  const [response, setResponse] = useState(
    () => initialResponse ?? savedDraft ?? '',
  );
  const [draftStatus, setDraftStatus] = useState<DraftStatus | null>(() =>
    savedDraft !== null ? 'saved' : null,
  );

  useEffect(() => {
    if (initialResponse === undefined) return;
    if (initialResponse.trim()) {
      saveDraft(draftKeyValue, initialResponse);
    } else {
      removeDraftAndLegacy(draftKeyValue, legacyDraftKeyValue);
    }
  }, [draftKeyValue, initialResponse, legacyDraftKeyValue]);

  const updateResponse = useCallback(
    (next: string) => {
      setResponse(next);
      if (next.trim()) {
        setDraftStatus(saveDraft(draftKeyValue, next));
        return;
      }
      setDraftStatus(
        removeDraftAndLegacy(draftKeyValue, legacyDraftKeyValue) === 'removed'
          ? null
          : 'unavailable',
      );
    },
    [draftKeyValue, legacyDraftKeyValue],
  );

  const clearDraft = useCallback(() => {
    setDraftStatus(
      removeDraftAndLegacy(draftKeyValue, legacyDraftKeyValue) === 'removed'
        ? null
        : 'unavailable',
    );
  }, [draftKeyValue, legacyDraftKeyValue]);

  return { clearDraft, draftStatus, response, updateResponse };
}
