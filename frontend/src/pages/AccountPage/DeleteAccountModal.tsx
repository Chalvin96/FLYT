import { useId, useState } from 'react';
import { isAxiosError } from 'axios';

import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { Modal } from '@/components/common/Modal/Modal';
import { Input } from '@/components/ui/input';
import { useDeleteAccount, useDeletionPreview } from '@/hooks/account/queries';
import { type DeletionPreviewRead } from '@/types/api';

const COUNT_FORMATTER = new Intl.NumberFormat();

const LOSS_LABELS: Array<[keyof DeletionPreviewRead, string]> = [
  ['streak', 'day streak'],
  ['reviews', 'reviews'],
  ['wordsPracticed', 'words practiced'],
  ['importedTexts', 'imported texts'],
];

const GATEWAY_STATUSES = [502, 503, 504];

function isOutcomeUnknown(error: unknown) {
  if (!isAxiosError(error)) return true;

  const status = error.response?.status;

  return status === undefined || GATEWAY_STATUSES.includes(status);
}

export interface DeleteAccountModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onDeleted: () => void;
  onUnconfirmed: () => void;
}

function LossPanel({
  preview,
  isLoading,
}: {
  preview?: DeletionPreviewRead;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div
        aria-label="Loading what deletion removes"
        className="grid gap-2.5"
        role="status"
      >
        {[55, 70, 48, 62].map((width) => (
          <span
            className="h-3 animate-pulse rounded-full bg-secondary-10"
            key={width}
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5">
      {LOSS_LABELS.map(([key, label]) => (
        <div className="contents" key={key}>
          <dd className="type-section font-bold text-foreground">
            {preview ? COUNT_FORMATTER.format(preview[key]) : '—'}
          </dd>
          <dt className="type-caption text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function DeleteAccountModal({
  isOpen,
  email,
  onClose,
  onDeleted,
  onUnconfirmed,
}: DeleteAccountModalProps) {
  const [typed, setTyped] = useState('');
  const preview = useDeletionPreview(isOpen);
  const deletion = useDeleteAccount(onDeleted);
  const inputId = useId();
  const hintId = useId();

  const isArmed = typed.trim().toLowerCase() === email.trim().toLowerCase();
  const isDeleting = deletion.isPending;

  function dismiss() {
    if (isDeleting) return;
    setTyped('');
    deletion.reset();
    onClose();
  }

  function confirm() {
    if (!isArmed || isDeleting) return;

    deletion.mutate(undefined);
  }

  return (
    <Modal
      description="This cannot be undone. Deleting removes:"
      footer={
        <>
          <Button
            disabled={isDeleting}
            onClick={dismiss}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!isArmed || isDeleting || !preview.data}
            onClick={confirm}
            type="button"
            variant="destructive"
          >
            {isDeleting ? 'Deleting...' : 'Delete account'}
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={dismiss}
      title="Delete your account?"
    >
      <div className="space-y-4">
        <div
          className={`radius-field border border-border bg-white-100 p-3.5 ${
            isDeleting ? 'opacity-50' : ''
          }`}
        >
          <LossPanel
            isLoading={preview.isLoading || preview.isFetching}
            preview={preview.data}
          />
        </div>

        {preview.isError && (
          <ErrorMessage
            error="We could not load what deletion removes. Try again."
            onRetry={() => {
              void preview.refetch();
            }}
            title="Preview failed"
          />
        )}

        <div>
          <label
            className="type-label-xs text-muted-foreground"
            htmlFor={inputId}
          >
            Type <strong className="text-foreground">{email}</strong> to confirm
          </label>
          <Input
            aria-describedby={hintId}
            autoComplete="off"
            className="mt-1.5 h-11"
            disabled={isDeleting}
            id={inputId}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={email}
            value={typed}
          />
          <p
            className="mt-1.5 type-caption-sm text-muted-foreground"
            id={hintId}
          >
            Delete account stays unavailable until this matches.
          </p>
        </div>

        {deletion.isError &&
          (isOutcomeUnknown(deletion.error) ? (
            <ErrorMessage
              error="We lost contact before your account confirmed. It may or may not have been deleted. Sign in again to see where you stand."
              onRetry={onUnconfirmed}
              retryLabel="Sign in again"
              title="Deletion unconfirmed"
            />
          ) : (
            <ErrorMessage
              error="We could not delete your account. Nothing was removed — try again."
              title="Deletion failed"
            />
          ))}
      </div>
    </Modal>
  );
}
