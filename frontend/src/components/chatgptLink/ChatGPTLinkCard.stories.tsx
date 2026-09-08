import type { Meta, StoryObj } from '@storybook/react';

import type { ChatGPTLink } from '@/api/chatgptLink';

import { ChatGPTLinkCard } from './ChatGPTLinkCard';

const future = new Date(Date.now() + 9 * 60_000).toISOString();
const baseLink: ChatGPTLink = {
  state: 'absent',
  broken_reason: null,
  connected_at: null,
  pending: null,
  model: 'gpt-5.6-luna',
  available_models: ['gpt-5.6-luna'],
};

const meta = {
  title: 'ChatGPT link/ChatGPTLinkCard',
  component: ChatGPTLinkCard,
  args: {
    link: baseLink,
    onConnect: () => undefined,
    onDisconnect: () => undefined,
  },
} satisfies Meta<typeof ChatGPTLinkCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {};

export const Waiting: Story = {
  args: {
    link: {
      ...baseLink,
      pending: { user_code: 'QYTZ-WD1Q4', expires_at: future },
    },
  },
};

export const Connected: Story = {
  args: {
    link: {
      ...baseLink,
      state: 'working',
      connected_at: '2026-07-12T00:00:00Z',
    },
  },
};

export const Disconnected: Story = {
  args: {
    link: {
      ...baseLink,
      state: 'broken',
      broken_reason: 'refresh_token_reused',
    },
  },
};

export const PlanIneligible: Story = {
  args: { terminalIneligible: true },
};
