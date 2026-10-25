import { Button, Card, Heading, Modal, Row, Text } from '@flyt/ui';
import { ChevronRight, Pencil } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

import {
  OPTIMISTIC_IMPORT_ID_PREFIX,
  useDeleteImport,
  useRetryImport,
} from '@/hooks/imports/queries';
import type { ImportItem } from '@/types/api';

import { getImportCardStatus, getImportCoverLabel } from './importDisplay';
import { ImportRenameForm } from './ImportRenameForm';
import { ImportStatusChip } from './ImportStatusChip';
import {
  formatReadingNumber,
  formatReadingPublishedShortDate,
  formatReadingWordCount,
} from './readingDisplay';

interface ImportStatusCardProps {
  item: ImportItem;
}

function ImportTitle({ item }: { item: ImportItem }) {
  return (
    <div className="line-clamp-2 break-words">
      <Heading as="h3" size="small" lang="nb" title={item.title}>
        {item.title}
      </Heading>
    </div>
  );
}

function ImportSource({ item }: { item: ImportItem }) {
  return (
    <span className="min-w-0 truncate" title={item.sourceUrl ?? 'Pasted text'}>
      <Text as="span" size="small" tone="subtle">
        {item.sourceUrl ? getImportCoverLabel(item) : 'Pasted text'}
      </Text>
    </span>
  );
}

export function ImportStatusCard({ item }: ImportStatusCardProps) {
  const status = getImportCardStatus(item);
  const [isRenaming, setIsRenaming] = useState(false);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
  const renameButton = (
    <Button
      ref={renameButtonRef}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Rename ${item.title}`}
      aria-expanded={isRenaming}
      onClick={() => setIsRenaming(true)}
      disabled={isRenaming || item.id.startsWith(OPTIMISTIC_IMPORT_ID_PREFIX)}
    >
      <Pencil className="icon-sm" aria-hidden />
    </Button>
  );
  const renameForm = isRenaming ? (
    <ImportRenameForm
      item={item}
      onClose={() => {
        setIsRenaming(false);
        requestAnimationFrame(() => renameButtonRef.current?.focus());
      }}
    />
  ) : null;

  if (status === 'ready') {
    return (
      <ReadyImportCard
        item={item}
        renameButton={renameButton}
        renameForm={renameForm}
      />
    );
  }

  return (
    <Card
      padding="compact"
      surface="solid"
      elevation="flat"
      aria-label={`${item.title}: ${status === 'processing' ? 'processing' : 'import failed'}`}
      aria-busy={status === 'processing' ? true : undefined}
    >
      <div className="space-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <ImportStatusChip item={item} />
          <ImportSource item={item} />
        </div>
        <div className="flex items-start justify-between gap-2">
          <ImportTitle item={item} />
          {renameButton}
        </div>
        {renameForm}
        {status === 'processing' ? (
          <Text as="p" size="small" tone="subtle">
            Turning it into a tap-to-read text. Usually under a minute.
          </Text>
        ) : (
          <FailedImportDetails item={item} />
        )}
      </div>
    </Card>
  );
}

function ReadyImportCard({
  item,
  renameButton,
  renameForm,
}: {
  item: ImportItem;
  renameButton: ReactNode;
  renameForm: ReactNode;
}) {
  return (
    <Card padding="none" surface="solid" elevation="flat">
      <div className="flex items-center">
        <div className="min-w-0 flex-1">
          <Row
            asChild
            size="md"
            surface="plain"
            trailing={
              <ChevronRight className="icon-sm text-icon-default" aria-hidden />
            }
          >
            <Link
              to="/reading/story/$uuid"
              params={{ uuid: item.storyUuid }}
              title={item.title}
            >
              <div className="space-y-1">
                <div className="flex">
                  <ImportSource item={item} />
                </div>
                <ImportTitle item={item} />
                <Text as="p" size="small" tone="subtle">
                  <span
                    title={`${item.wordCount.toLocaleString('en-US')} words`}
                  >
                    {[
                      formatReadingWordCount(item.wordCount),
                      item.pageCount == null
                        ? null
                        : `${formatReadingNumber(item.pageCount)} ${item.pageCount === 1 ? 'page' : 'pages'}`,
                      formatReadingPublishedShortDate(item.createdAt),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Text>
              </div>
            </Link>
          </Row>
        </div>
        <div className="pr-3">{renameButton}</div>
      </div>
      {renameForm ? <div className="px-4 pb-4">{renameForm}</div> : null}
    </Card>
  );
}

function FailedImportDetails({ item }: { item: ImportItem }) {
  const retryImport = useRetryImport();
  const deleteImport = useDeleteImport();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <>
      <div
        className="line-clamp-2 break-words"
        title={item.errorMessage ?? undefined}
      >
        <Text as="p" size="small" tone="danger">
          {item.errorMessage ?? 'This text could not be processed.'}
        </Text>
      </div>
      {item.errorCode ? (
        <div className="break-all">
          <Text as="p" font="mono" size="small" tone="danger">
            {item.errorCode}
          </Text>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={retryImport.isPending}
          onClick={() => retryImport.mutate(item.id)}
        >
          {retryImport.isPending ? 'Retrying...' : 'Retry'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={deleteImport.isPending}
          onClick={() => setIsConfirmOpen(true)}
        >
          {deleteImport.isPending ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
      <DeleteConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={item.title}
        isPending={deleteImport.isPending}
        onConfirm={() =>
          deleteImport.mutate(item.id, {
            onSettled: () => setIsConfirmOpen(false),
          })
        }
      />
    </>
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
            variant="danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </>
      }
    >
      <Text size="medium" tone="subtle">
        Import: <span lang="nb">{title}</span>
      </Text>
    </Modal>
  );
}
