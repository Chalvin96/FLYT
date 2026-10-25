import { Button, Card, Heading, Input, Text } from '@flyt/ui';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { ACCOUNT_PAGE_ANCHORS } from '@/components/nav/accountNavigation';
import { useMe } from '@/hooks/auth/queries';
import {
  getChatbotErrorMessage,
  useChatbotSurface,
  useDeleteOpenRouterKey,
  useReplaceOpenRouterKey,
} from '@/hooks/chatbot/queries';

export function OpenRouterKeySection() {
  const { data: user } = useMe();
  const accountId = user?.id ?? null;
  const surfaceQuery = useChatbotSurface(accountId);

  if (!surfaceQuery.data) {
    return (
      <Card padding="compact">
        <ProviderKeySectionHeading />
        {surfaceQuery.isError ? (
          <div className="mt-4">
            <ErrorMessage
              error="Provider key settings could not be loaded. Try again in a moment."
              onRetry={() => void surfaceQuery.refetch()}
              title="Provider key settings unavailable"
            />
          </div>
        ) : (
          <div className="mt-4" role="status">
            <Text as="p" size="medium" tone="subtle">
              Loading provider key settings…
            </Text>
          </div>
        )}
      </Card>
    );
  }

  return (
    <OpenRouterKeyCard accountId={accountId} surface={surfaceQuery.data} />
  );
}

function OpenRouterKeyCard({
  accountId,
  surface,
}: {
  accountId: string | number | null;
  surface: NonNullable<ReturnType<typeof useChatbotSurface>['data']>;
}) {
  const replaceKey = useReplaceOpenRouterKey(accountId);
  const deleteKey = useDeleteOpenRouterKey(accountId);
  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const configured = surface.openrouterKeyConfigured;
  const updateError = replaceKey.error ?? deleteKey.error;
  const error =
    localError ?? (updateError ? getChatbotErrorMessage(updateError) : null);

  const startEditing = () => {
    setLocalError(null);
    setIsEditing(true);
  };

  const stopEditing = () => {
    setApiKey('');
    setIsEditing(false);
    setLocalError(null);
  };

  const handleSave = async () => {
    const value = apiKey.trim();
    if (!value) {
      setLocalError('Enter your provider key.');
      return;
    }

    setLocalError(null);
    try {
      await replaceKey.mutateAsync(value);
      setApiKey('');
      setIsEditing(false);
    } catch (error) {
      setLocalError(getChatbotErrorMessage(error));
    }
  };

  const handleRemove = async () => {
    setLocalError(null);
    try {
      await deleteKey.mutateAsync();
      setApiKey('');
      setIsEditing(false);
    } catch (error) {
      setLocalError(getChatbotErrorMessage(error));
    }
  };

  return (
    <section aria-label="Provider key settings">
      <Card padding="compact" data-testid="openrouter-key-section">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <KeyIdentity configured={configured} />
            {!isEditing ? (
              <KeyActions
                configured={configured}
                isRemoving={deleteKey.isPending}
                onEdit={startEditing}
                onRemove={() => void handleRemove()}
              />
            ) : null}
          </div>

          <Text as="p" size="medium" tone="subtle">
            Use it for DeepSeek or z.ai.
          </Text>

          {isEditing ? (
            <KeyEditForm
              apiKey={apiKey}
              isSaving={replaceKey.isPending}
              onCancel={stopEditing}
              onChangeApiKey={(value) => {
                setLocalError(null);
                setApiKey(value);
              }}
              onSave={() => void handleSave()}
            />
          ) : null}

          {error ? (
            <div className="text-danger" role="alert">
              <Text as="p" size="small">
                {error}
              </Text>
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

function ProviderKeySectionHeading() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="radius-field flex size-11 shrink-0 items-center justify-center bg-neutral-pressed text-default">
        <KeyRound aria-hidden="true" className="icon-sm" />
      </div>
      <div className="scroll-mt-24 focus:outline-none">
        <Heading
          as="h2"
          id={ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY}
          tabIndex={-1}
          size="medium"
          tone="default"
        >
          Provider key
        </Heading>
      </div>
    </div>
  );
}

function KeyIdentity({ configured }: { configured: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="radius-field flex size-11 shrink-0 items-center justify-center bg-neutral-pressed text-default">
        <KeyRound aria-hidden="true" className="icon-sm" />
      </div>
      <div className="min-w-0">
        <div className="scroll-mt-24 focus:outline-none">
          <Heading
            as="h2"
            id={ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY}
            tabIndex={-1}
            size="medium"
            tone="default"
          >
            Provider key
          </Heading>
        </div>
        <Text as="p" size="medium" tone="subtle">
          {configured ? 'Connected' : 'Not connected'}
        </Text>
      </div>
    </div>
  );
}

function KeyActions({
  configured,
  isRemoving,
  onEdit,
  onRemove,
}: {
  configured: boolean;
  isRemoving: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  if (!configured) {
    return (
      <div className="flex shrink-0 gap-1">
        <Button onClick={onEdit} size="sm" type="button">
          Add key
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Button onClick={onEdit} size="sm" type="button" variant="ghost">
        Update key
      </Button>
      <Button
        disabled={isRemoving}
        onClick={onRemove}
        size="sm"
        type="button"
        variant="ghost"
      >
        {isRemoving ? 'Removing…' : 'Remove'}
      </Button>
    </div>
  );
}

function KeyEditForm({
  apiKey,
  isSaving,
  onCancel,
  onChangeApiKey,
  onSave,
}: {
  apiKey: string;
  isSaving: boolean;
  onCancel: () => void;
  onChangeApiKey: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <form
      className="radius-field border border-default bg-overlay p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <label
        className="flex items-center justify-between"
        htmlFor="openrouter-api-key"
      >
        <Heading as="span" size="xxsmall" tone="subtle">
          Provider API key
        </Heading>
      </label>
      <Input
        autoComplete="off"
        size="lg"
        id="openrouter-api-key"
        name="openrouter-api-key"
        onChange={(event) => onChangeApiKey(event.target.value)}
        placeholder="Paste your provider key"
        type="password"
        value={apiKey}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button disabled={isSaving} size="sm" type="submit">
          {isSaving ? 'Saving…' : 'Save key'}
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}
