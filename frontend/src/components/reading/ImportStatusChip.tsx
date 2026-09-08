import { AlertCircle, Check, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ImportItem } from '@/types/api';

import {
  getImportCardStatus,
  IMPORT_STATUS_CHIP_CLASS_NAMES,
  IMPORT_STATUS_LABELS,
} from './importDisplay';

interface ImportStatusChipProps {
  item: ImportItem;
  className?: string;
}

export function ImportStatusChip({ item, className }: ImportStatusChipProps) {
  const status = getImportCardStatus(item);
  const label = `${IMPORT_STATUS_LABELS[status]}${status === 'processing' ? '…' : ''}`;

  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy={status === 'processing'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 type-caption-sm font-semibold',
        IMPORT_STATUS_CHIP_CLASS_NAMES[status],
        className,
      )}
    >
      {status === 'processing' ? (
        <Loader2 className="icon-xs animate-spin" aria-hidden />
      ) : status === 'ready' ? (
        <Check className="icon-xs" aria-hidden />
      ) : (
        <AlertCircle className="icon-xs" aria-hidden />
      )}
      {label}
    </span>
  );
}
