import { Button, Input, Text } from '@flyt/ui';
import { useEffect, useId, useRef, useState } from 'react';

import { useRenameImport } from '@/hooks/imports/queries';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ImportItem } from '@/types/api';

const IMPORT_TITLE_MAX_LENGTH = 200;

export function ImportRenameForm({
  item,
  onClose,
}: {
  item: ImportItem;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(item.title);
  const rename = useRenameImport();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const title = draft.trim();
        if (!title || rename.isPending) return;
        rename.mutate({ id: item.id, title }, { onSuccess: onClose });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !rename.isPending) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <Input
        ref={inputRef}
        aria-label="Import title"
        aria-describedby={rename.isError ? errorId : undefined}
        aria-invalid={rename.isError || undefined}
        lang="nb"
        maxLength={IMPORT_TITLE_MAX_LENGTH}
        value={draft}
        disabled={rename.isPending}
        onChange={(event) => setDraft(event.target.value)}
      />
      {rename.isError ? (
        <div id={errorId} role="alert">
          <Text as="p" size="small" tone="danger">
            {getApiErrorMessage(rename.error)}
          </Text>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={!draft.trim() || rename.isPending}
        >
          {rename.isPending ? 'Saving…' : 'Save title'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={rename.isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
