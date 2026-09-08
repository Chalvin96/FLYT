import type { Preview } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '../src/index.css';

function WithDarkMode({
  Story,
  theme,
}: {
  Story: React.ComponentType;
  theme: string;
}) {
  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    return () => html.classList.remove('dark');
  }, [theme]);

  return <Story />;
}

const withDarkMode = (
  Story: React.ComponentType,
  context: { globals: { theme?: string } },
) => <WithDarkMode Story={Story} theme={context.globals.theme ?? 'light'} />;

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
      <Story />
    </QueryClientProvider>
  );
}

const withQueryClient = (Story: React.ComponentType) => (
  <WithQueryClient Story={Story} />
);

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withQueryClient, withDarkMode],
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
