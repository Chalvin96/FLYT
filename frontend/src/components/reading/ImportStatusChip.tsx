import { Badge } from '@flyt/ui';
import { AlertCircle, Loader2 } from 'lucide-react';

import type { ImportItem } from '@/types/api';

import { getImportCardStatus, IMPORT_STATUS_LABELS } from './importDisplay';

export function ImportStatusChip({ item }: { item: ImportItem }) {
  const status = getImportCardStatus(item);
  return (
    <Badge
      tone={status === 'failed' ? 'danger' : 'neutral'}
      shape="pill"
      size="sm"
    >
      <span className="inline-flex items-center gap-1">
        {status === 'processing' ? (
          <Loader2
            className="icon-xs animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : status === 'failed' ? (
          <AlertCircle className="icon-xs" aria-hidden />
        ) : null}
        {IMPORT_STATUS_LABELS[status]}
        {status === 'processing' ? '...' : ''}
      </span>
    </Badge>
  );
}
