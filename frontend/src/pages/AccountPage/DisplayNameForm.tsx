import { Button, Heading, Input, Text } from '@flyt/ui';
import { PencilLine, Save } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { useMe, useUpdateMe } from '@/hooks/auth/queries';

type MeData = NonNullable<ReturnType<typeof useMe>['data']>;

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
      className="radius-field border border-default bg-overlay p-3"
      key={user?.display_name}
      onSubmit={handleSaveName}
    >
      <label className="text-subtle" htmlFor="display-name">
        <Heading as="span" size="xxsmall">
          Display name
        </Heading>
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Input
          presentation={isEditingName ? 'default' : 'quiet'}
          size="lg"
          id="display-name"
          maxLength={255}
          name="display_name"
          onChange={(event) => setDraftName(event.target.value)}
          ref={displayNameInputRef}
          value={isEditingName ? draftName : (user?.display_name ?? '')}
        />
        {isEditingName ? (
          <Button
            width="full-on-mobile"
            disabled={!user || updateMe.isPending}
            type="submit"
            variant="secondary"
          >
            <Save className="icon-sm" />
            {updateMe.isPending ? 'Saving...' : 'Save'}
          </Button>
        ) : (
          <Button
            width="full-on-mobile"
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
        <div className="mt-2 text-danger">
          <Text as="p" size="medium">
            {formError ?? 'Could not update your name. Try again.'}
          </Text>
        </div>
      ) : null}
    </form>
  );
}
