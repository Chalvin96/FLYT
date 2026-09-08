import type { ChatGPTLinkStart } from '@/api/chatgptLink';

export const CONNECTED_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
});

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function getAuthorizationUrl(
  authorization: ChatGPTLinkStart | null | undefined,
): string {
  return authorization?.verification_url ?? 'https://auth.openai.com/device';
}

export function secondsRemaining(expiresAt: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
}

export function formatLinkCaption({
  connectedAt,
  isLapsed,
  linkIsBroken,
  pending,
  remaining,
  working,
}: {
  connectedAt: string | null;
  isLapsed: boolean;
  linkIsBroken: boolean;
  pending: { user_code: string } | null;
  remaining: number;
  working: boolean;
}): string {
  if (pending) {
    return isLapsed
      ? 'Code expired'
      : `${pending.user_code} · expires in ${formatCountdown(remaining)}`;
  }
  if (working && connectedAt) {
    return `Connected ${CONNECTED_DATE_FORMATTER.format(new Date(connectedAt))}`;
  }
  return linkIsBroken ? 'Disconnected' : 'Not connected';
}

export function formatPrimaryActionLabel({
  isLapsed,
  linkIsBroken,
  pending,
  working,
}: {
  isLapsed: boolean;
  linkIsBroken: boolean;
  pending: { user_code: string } | null;
  working: boolean;
}): string {
  if (pending) {
    return isLapsed ? 'Get a new code' : 'Show code';
  }
  if (working) {
    return 'Disconnect';
  }
  return linkIsBroken ? 'Reconnect' : 'Connect';
}
