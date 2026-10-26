import type { Preview } from '@storybook/react-vite';
import { domMax, LazyMotion } from 'motion/react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '../src/index.css';

import { collectCornerBleeds, finishAnimations } from '../src/test/cornerBleed';

function createStorybookQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function WithQueryClient({ Story }: { Story: React.ComponentType }) {
  const [queryClient] = useState(createStorybookQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domMax}>
        <Story />
      </LazyMotion>
    </QueryClientProvider>
  );
}

const withQueryClient = (Story: React.ComponentType) => (
  <WithQueryClient Story={Story} />
);

const preview: Preview = {
  decorators: [withQueryClient],
  afterEach: ({ canvasElement }) => {
    finishAnimations(canvasElement);
    const bleeds = collectCornerBleeds(canvasElement);
    if (bleeds.length > 0) {
      throw new Error(
        `Rounded corner bleeds:\n${bleeds.map((bleed) => `- ${bleed.description}`).join('\n')}`,
      );
    }
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
