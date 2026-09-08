import { PencilLine, Save } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/common/Button/Button';
import { Input } from '@/components/ui/input';
import type { useMe, useUpdateMe } from '@/hooks/auth/queries';

type MeData = NonNullable<ReturnType<typeof useMe>['data']>;

/**
 * Display-name editing: read-only input that flips into an editable save
 * flow. Optimistic local validation plus the mutation's own error state
 * surface under the field.
 */
export function DisplayNameForm({
  user,
  updateMe,
}: {
  user: MeData | undefined;
  updateMe: ReturnType<typeof useUpdateMe>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const displayNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingName) return;

    displayNameInputRef.current?.focus();
    displayNameInputRef.current?.select();
  }, [isEditingName]);

  async function handleSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || updateMe.isPending || !isEditingName) return;

    const nextName = draftName.trim();

    if (!nextName) {
      setFormError('Enter a display name.');
      return;
    }

    setFormError(null);
    if (nextName === user.display_name) {
      setIsEditingName(false);
      return;
    }

    await updateMe.mutateAsync({ display_name: nextName });
    setIsEditingName(false);
  }

  function handleEditName() {
    setFormError(null);
    setDraftName(user?.display_name ?? '');
    setIsEditingName(true);
  }

  return (
    <form
      className="radius-field border border-border bg-white-100 p-3"
      key={user?.display_name}
      onSubmit={handleSaveName}
    >
      <label
        className="type-label-xs text-muted-foreground"
        htmlFor="display-name"
      >
        Display name
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Input
          className={
            isEditingName
              ? 'h-11'
              : 'h-11 cursor-default border-secondary-20 bg-secondary-0 shadow-none focus-visible:ring-0'
          }
          id="display-name"
          maxLength={255}
          name="display_name"
          onChange={(event) => setDraftName(event.target.value)}
          readOnly={!isEditingName}
          ref={displayNameInputRef}
          value={isEditingName ? draftName : (user?.display_name ?? '')}
        />
        {isEditingName ? (
          <Button
            className="h-11 sm:w-auto"
            disabled={!user || updateMe.isPending}
            type="submit"
            variant="secondary"
          >
            <Save className="icon-sm" />
            {updateMe.isPending ? 'Saving...' : 'Save'}
          </Button>
        ) : (
          <Button
            className="h-11 sm:w-auto"
            disabled={!user}
            onClick={handleEditName}
            type="button"
            variant="outline"
          >
            <PencilLine className="icon-sm" />
            Edit
          </Button>
        )}
      </div>
      {formError || updateMe.isError ? (
        <p className="type-caption mt-2 text-destructive-70">
          {formError ?? 'Could not update your name. Try again.'}
        </p>
      ) : null}
    </form>
  );
}
