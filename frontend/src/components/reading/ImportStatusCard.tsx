import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { Modal } from '@/components/common/Modal/Modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteImport, useRetryImport } from '@/hooks/imports/queries';
import { cn } from '@/lib/utils';
import { type ImportItem } from '@/types/api';

import {
  formatImportShortDate,
  formatImportWordCount,
  getImportCardStatus,
  getImportCoverLabel,
} from './importDisplay';
import { ImportStatusChip } from './ImportStatusChip';

interface ImportStatusCardProps {
  item: ImportItem;
  variant?: 'shelf' | 'grid';
}

export function ImportStatusCard({
  item,
  variant = 'shelf',
}: ImportStatusCardProps) {
  const status = getImportCardStatus(item);
  const retryImport = useRetryImport();
  const deleteImport = useDeleteImport();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const cardClassName = cn(
    'relative flex h-full min-h-[264px] flex-col overflow-hidden border-border bg-white-100 p-0 transition-[border-color,background-color,transform] duration-200 sm:min-h-[292px]',
    variant === 'shelf' && 'w-[232px] shrink-0 sm:w-[280px]',
  );

  // Busy: non-interactive.
  if (status === 'processing') {
    return (
      <AppCard
        className={cardClassName}
        aria-busy="true"
        aria-label={`${item.title}: processing`}
      >
        <ImportStatusChip item={item} className="absolute right-2 top-2 z-10" />
        <div className="import-cover-shimmer relative h-[120px] w-full shrink-0 overflow-hidden bg-secondary-20 sm:h-[140px]" />
        <div className="flex flex-1 flex-col gap-3 bg-white-100 p-4">
          <h3 className="type-body font-semibold text-muted-foreground">
            {item.title}
          </h3>
          <div className="space-y-2" aria-hidden>
            <Skeleton className="h-3 w-[90%]" />
            <Skeleton className="h-3 w-[68%]" />
          </div>
          <p className="mt-auto type-caption-sm text-muted-foreground">
            Auto-updates when ready
          </p>
        </div>
      </AppCard>
    );
  }

  if (status === 'failed') {
    return (
      <AppCard
        className={cardClassName}
        aria-label={`${item.title}: import failed`}
      >
        <ImportStatusChip item={item} className="absolute right-2 top-2 z-10" />
        <div className="flex h-[120px] w-full shrink-0 items-end bg-gradient-to-br from-destructive-70 to-warning-60 px-3 pb-3 type-caption font-semibold text-white-100 sm:h-[140px]">
          Import failed
        </div>
        <div className="flex flex-1 flex-col gap-3 bg-white-100 p-4">
          <h3 className="type-body font-semibold text-foreground">
            {item.title}
          </h3>
          <p className="line-clamp-2 type-caption leading-6 text-muted-foreground">
            {item.errorMessage ?? 'This text could not be processed.'}
          </p>
          <div className="mt-auto flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 px-3"
              disabled={retryImport.isPending}
              onClick={() => retryImport.mutate(item.id)}
            >
              {retryImport.isPending ? 'Retrying…' : 'Retry'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3"
              disabled={deleteImport.isPending}
              onClick={() => setIsConfirmOpen(true)}
            >
              {deleteImport.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
          <DeleteConfirmDialog
            isOpen={isConfirmOpen}
            onOpenChange={setIsConfirmOpen}
            title={item.title}
            isPending={deleteImport.isPending}
            onConfirm={() => {
              deleteImport.mutate(item.id, {
                onSettled: () => setIsConfirmOpen(false),
              });
            }}
          />
        </div>
      </AppCard>
    );
  }

  // Ready: open the reused reader (C-07).
  return (
    <Link
      to="/reading/story/$uuid"
      params={{ uuid: item.storyUuid }}
      className="group block focus-visible:outline-none"
    >
      <AppCard
        className={cn(
          cardClassName,
          'cursor-pointer group-hover:-translate-y-0.5 group-hover:border-primary-70 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background',
        )}
      >
        <ImportStatusChip item={item} className="absolute right-2 top-2 z-10" />
        <div className="flex h-[120px] w-full shrink-0 items-end bg-gradient-to-br from-secondary-80 to-secondary-60 px-3 pb-3 type-caption font-semibold text-white-100 sm:h-[140px]">
          <span className="truncate">{getImportCoverLabel(item)}</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 bg-white-100 p-4">
          <h3 className="type-body font-semibold text-foreground">
            {item.title}
          </h3>
          <p className="mt-auto type-caption-sm text-muted-foreground">
            {formatImportWordCount(item.wordCount)}
            {item.pageCount
              ? ` · ${item.pageCount} ${item.pageCount === 1 ? 'page' : 'pages'}`
              : ''}
            {' · '}
            {formatImportShortDate(item.createdAt)}
          </p>
        </div>
      </AppCard>
    </Link>
  );
}

function DeleteConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  isPending,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isPending) onOpenChange(false);
      }}
      title="Delete this import?"
      description="This permanently removes the text and your reading progress for it. This action cannot be undone."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    >
      <p className="type-caption text-muted-foreground">Import: {title}</p>
    </Modal>
  );
}
