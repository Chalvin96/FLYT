import { useEffect } from 'react';

import { CHATGPT_LINK_ERROR } from '@/api/chatgptLink';
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

  const failure: ChatGPTLinkFailure | null =
    errorCode === CHATGPT_LINK_ERROR.MODEL_UNAVAILABLE
      ? {
          message:
            'That model is not available on your ChatGPT plan. Check your plan and try again.',
        }
      : errorCode === CHATGPT_LINK_ERROR.TRANSIENT
        ? {
            cta: { label: 'Try again', onClick: handleConnect },
            message:
              'ChatGPT could not be reached. This is usually temporary — try again in a moment.',
          }
        : errorCode === CHATGPT_LINK_ERROR.DISABLED
          ? {
              message:
                'ChatGPT connections are turned off right now. Try again later.',
            }
          : deleteLink.error
            ? {
                cta: {
                  label: 'Try again',
                  onClick: () => deleteLink.mutate(),
                },
                message:
                  'Flyt could not disconnect ChatGPT. Nothing changed — try again in a moment.',
              }
            : null;

  if (!linkQuery.data) return null;

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
