import { Card, Heading, Text } from '@flyt/ui';
import { Bot } from 'lucide-react';
import { useEffect } from 'react';

import { CHATGPT_LINK_ERROR } from '@/api/chatgptLink';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';
import { ACCOUNT_PAGE_ANCHORS } from '@/components/nav/accountNavigation';
import {
  getChatGPTLinkErrorCode,
  useChatGPTLink,
  useDeleteChatGPTLink,
  usePollChatGPTLink,
  useStartChatGPTLink,
} from '@/hooks/chatgptLink/queries';

import { ChatGPTLinkCard, type ChatGPTLinkFailure } from './ChatGPTLinkCard';

export function ChatGPTLinkSection() {
  const linkQuery = useChatGPTLink();
  const startLink = useStartChatGPTLink();
  const {
    error: pollError,
    isPending: isPolling,
    mutate: pollLink,
  } = usePollChatGPTLink();
  const deleteLink = useDeleteChatGPTLink();
  useEffect(() => {
    if (!linkQuery.data?.pending?.user_code) return;

    const poll = () => {
      if (!isPolling) pollLink();
    };
    const interval = window.setInterval(poll, 2_000);
    return () => window.clearInterval(interval);
  }, [isPolling, linkQuery.data?.pending?.user_code, pollLink]);

  const isWorking = linkQuery.data?.state === 'working';
  useEffect(() => {
    if (isWorking && startLink.data) startLink.reset();
  }, [isWorking, startLink]);

  function handleConnect() {
    startLink.mutate();
  }

  const errorCode = getChatGPTLinkErrorCode(
    pollError ?? startLink.error ?? deleteLink.error,
  );
  const terminalIneligible = errorCode === CHATGPT_LINK_ERROR.INELIGIBLE;
  const failure = buildChatGPTLinkFailure(
    errorCode,
    Boolean(deleteLink.error),
    handleConnect,
    () => deleteLink.mutate(),
  );

  if (!linkQuery.data) {
    return (
      <Card padding="compact">
        <div className="space-y-4">
          <ChatGPTSectionHeading />
          {linkQuery.isError ? (
            <ErrorMessage
              error="ChatGPT connection settings could not be loaded. Try again in a moment."
              onRetry={() => void linkQuery.refetch()}
              title="ChatGPT connection unavailable"
            />
          ) : (
            <div role="status">
              <Text as="p" size="medium" tone="subtle">
                Loading ChatGPT connection settings…
              </Text>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <ChatGPTLinkCard
      authorization={pollError ? undefined : startLink.data}
      isDisconnecting={deleteLink.isPending}
      isStarting={startLink.isPending}
      link={linkQuery.data}
      onConnect={handleConnect}
      failure={failure}
      onDisconnect={() =>
        deleteLink.mutateAsync().then(
          () => true,
          () => false,
        )
      }
      terminalIneligible={terminalIneligible}
    />
  );
}

function buildChatGPTLinkFailure(
  errorCode: string | null,
  hasDeleteError: boolean,
  onConnect: () => void,
  onRetryDisconnect: () => void,
): ChatGPTLinkFailure | null {
  if (errorCode === CHATGPT_LINK_ERROR.MODEL_UNAVAILABLE) {
    return {
      message:
        'That model is not available on your ChatGPT plan. Check your plan and try again.',
    };
  }
  if (errorCode === CHATGPT_LINK_ERROR.TRANSIENT) {
    return {
      cta: { label: 'Try again', onClick: onConnect },
      message:
        'ChatGPT could not be reached. This is usually temporary — try again in a moment.',
    };
  }
  if (errorCode === CHATGPT_LINK_ERROR.DISABLED) {
    return {
      message: 'ChatGPT connections are turned off right now. Try again later.',
    };
  }
  if (!hasDeleteError) return null;

  return {
    cta: { label: 'Try again', onClick: onRetryDisconnect },
    message:
      'Flyt could not disconnect ChatGPT. Nothing changed — try again in a moment.',
  };
}

function ChatGPTSectionHeading() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="radius-field flex size-11 shrink-0 items-center justify-center bg-neutral-pressed text-default">
        <Bot aria-hidden="true" className="icon-sm" />
      </div>
      <div className="scroll-mt-24 focus:outline-none">
        <Heading
          as="h2"
          id={ACCOUNT_PAGE_ANCHORS.CHATGPT}
          tabIndex={-1}
          size="medium"
          tone="default"
        >
          ChatGPT
        </Heading>
      </div>
    </div>
  );
}
