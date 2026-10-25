export const ACCOUNT_PAGE_ANCHORS = {
  CHATGPT: 'chatgpt-connection',
  PROVIDER_KEY: 'provider-key-settings',
} as const;

export type AccountPageAnchor =
  (typeof ACCOUNT_PAGE_ANCHORS)[keyof typeof ACCOUNT_PAGE_ANCHORS];
