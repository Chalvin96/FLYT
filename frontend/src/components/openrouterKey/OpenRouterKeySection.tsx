import { KeyRound } from 'lucide-react';
import { useState } from 'react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { Input } from '@/components/ui/input';
import {
  getChatbotErrorMessage,
  useChatbotSurface,
  useDeleteOpenRouterKey,
  useReplaceOpenRouterKey,
} from '@/hooks/chatbot/queries';

export function OpenRouterKeySection() {
  const surfaceQuery = useChatbotSurface();
  const replaceKey = useReplaceOpenRouterKey();
  const deleteKey = useDeleteOpenRouterKey();
  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (surfaceQuery.isError && !surfaceQuery.data) {
    return (
      <AppCard className="p-4 sm:p-5">
        <ErrorMessage
          error="Provider key settings could not be loaded. Try again in a moment."
          onRetry={() => void surfaceQuery.refetch()}
          title="Provider key settings unavailable"
        />
      </AppCard>
    );
  }

  const surface = surfaceQuery.data;
  if (!surface) return null;

  const configured = surface.openrouterKeyConfigured;
  const updateError = replaceKey.error ?? deleteKey.error;
  const error =
    localError ?? (updateError ? getChatbotErrorMessage(updateError) : null);

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
      <AppCard
        className="space-y-4 p-4 sm:p-5"
        data-testid="openrouter-key-section"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="radius-field flex size-11 shrink-0 items-center justify-center bg-secondary-20 text-secondary-90">
              <KeyRound className="icon-sm" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="type-section font-semibold text-foreground">
                Provider key
              </p>
              <p className="type-caption text-muted-foreground">
                {configured ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          {!isEditing ? (
            <div className="flex shrink-0 gap-1">
              {configured ? (
                <>
                  <Button
                    onClick={() => {
                      setLocalError(null);
                      setIsEditing(true);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Update key
                  </Button>
                  <Button
                    disabled={deleteKey.isPending}
                    onClick={() => void handleRemove()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {deleteKey.isPending ? 'Removing…' : 'Remove'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setLocalError(null);
                    setIsEditing(true);
                  }}
                  size="sm"
                  type="button"
                >
                  Add key
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <p className="type-caption text-muted-foreground">
          Use it for DeepSeek or z.ai.
        </p>

        {isEditing ? (
          <form
            className="radius-field border border-border bg-white-100 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <label
              className="type-label-xs text-muted-foreground"
              htmlFor="openrouter-api-key"
            >
              Provider API key
            </label>
            <Input
              autoComplete="off"
              className="mt-2 h-11"
              id="openrouter-api-key"
              name="openrouter-api-key"
              onChange={(event) => {
                setLocalError(null);
                setApiKey(event.target.value);
              }}
              placeholder="Paste your provider key"
              type="password"
              value={apiKey}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button disabled={replaceKey.isPending} type="submit" size="sm">
                {replaceKey.isPending ? 'Saving…' : 'Save key'}
              </Button>
              <Button
                onClick={() => {
                  setApiKey('');
                  setIsEditing(false);
                  setLocalError(null);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p className="type-caption-sm text-destructive-70" role="alert">
            {error}
          </p>
        ) : null}
      </AppCard>
    </section>
  );
}
