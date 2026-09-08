import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeDetailPage } from './ThemeDetailPage';

let intersectionCallback:
  ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    intersectionCallback = callback;
  }
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    children: ReactNode;
    params?: Record<string, string>;
    to: string;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    return <a href={href}>{children}</a>;
  },
}));

const { getReadingStories } = vi.hoisted(() => ({
  getReadingStories: vi.fn(),
}));

vi.mock('@/api/reading', () => ({
  getReadingStories,
}));

const baseStories = [
  {
    uuid: 'story-1',
    title: 'Morning Coffee',
    cefrLevel: 'A1',
    createdAt: '2026-04-11T10:00:00Z',
    preview: 'Ida opens the window and starts the day with coffee.',
    wordCount: 245,
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    isRead: false,
    readAt: null,
  },
  {
    uuid: 'story-2',
    title: 'On the Tram',
    cefrLevel: 'A2',
    createdAt: '2026-04-10T10:00:00Z',
    preview: 'A short commute turns into a tiny language lesson.',
    wordCount: 198,
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    isRead: true,
    readAt: '2026-04-10T12:00:00Z',
  },
  {
    uuid: 'story-3',
    title: 'After Work',
    cefrLevel: 'B1',
    createdAt: '2026-04-09T10:00:00Z',
    preview: 'Two friends meet after work and compare their plans.',
    wordCount: 312,
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    isRead: false,
    readAt: null,
  },
] as const;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeDetailPage themeKey="daily_life" />
    </QueryClientProvider>,
  );
}

describe('ThemeDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionCallback = null;
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });

    getReadingStories.mockImplementation(
      async (
        _groupKey: string,
        options?: { levels?: string[]; showReadStories?: boolean },
      ) => {
        const filteredStories = baseStories.filter((story) => {
          if (!options?.showReadStories && story.isRead) {
            return false;
          }
          if (options?.levels && options.levels.length > 0) {
            return options.levels.includes(story.cefrLevel);
          }
          return true;
        });

        return {
          group: {
            id: 1,
            key: 'daily_life',
            order: 1,
            storyCount: 3,
            title: 'Daily Life',
          },
          stories: filteredStories,
          nextCursor: null,
          totalCount: 3,
          levelCounts: { A1: 1, A2: 1, B1: 1 },
        };
      },
    );
  });

  it('renders compact cards and can hide read stories', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Daily Life' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 stories')).toBeInTheDocument();
    expect(screen.getByText('Morning Coffee')).toBeInTheDocument();
    expect(screen.getByText(/245 words/)).toBeInTheDocument();
    expect(screen.getByText('On the Tram')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open filters' }));
    const firstDialog = screen.getByRole('dialog');
    await user.click(within(firstDialog).getByLabelText('Hide read stories'));
    await user.click(
      within(firstDialog).getByRole('button', { name: 'Apply' }),
    );

    expect(screen.getByText('Showing 2 of 3 stories')).toBeInTheDocument();
    expect(screen.queryByText('On the Tram')).not.toBeInTheDocument();

    const secondDialog = screen.queryByRole('dialog');

    if (!secondDialog) {
      await user.click(screen.getByRole('button', { name: 'Open filters' }));
    }

    const activeDialog = screen.getByRole('dialog');
    await user.click(within(activeDialog).getByLabelText(/Beginner 1 \(A1\)/));
    await user.click(
      within(activeDialog).getByRole('button', { name: 'Apply' }),
    );

    expect(screen.getByText('Showing 1 of 3 stories')).toBeInTheDocument();
    expect(screen.getByText('Morning Coffee')).toBeInTheDocument();
    expect(screen.queryByText('After Work')).not.toBeInTheDocument();
  });

  it('opens the mobile filter sheet from the fab and closes on apply', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Open filters' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open filters' }));

    expect(
      await screen.findByRole('button', { name: 'Apply' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Apply' }),
      ).not.toBeInTheDocument();
    });
  });

  it('discards mobile filter changes when the sheet closes without applying', async () => {
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Daily Life' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 stories')).toBeInTheDocument();
    expect(screen.getByText('On the Tram')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open filters' }));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Hide read stories'));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Showing 3 of 3 stories')).toBeInTheDocument();
    expect(screen.getByText('On the Tram')).toBeInTheDocument();
  });

  it('loads more stories when the scroll sentinel becomes visible', async () => {
    getReadingStories.mockImplementation(
      async (
        _groupKey: string,
        options?: { cursor?: string | null; showReadStories?: boolean },
      ) => {
        if (options?.cursor === 'cursor-2') {
          return {
            group: {
              id: 1,
              key: 'daily_life',
              order: 1,
              storyCount: 4,
              title: 'Daily Life',
            },
            stories: [
              {
                uuid: 'story-3',
                title: 'After Work',
                cefrLevel: 'B1',
                createdAt: '2026-04-09T10:00:00Z',
                preview: 'Two friends meet after work and compare their plans.',
                wordCount: 312,
                groupKey: 'daily_life',
                groupTitle: 'Daily Life',
                isRead: false,
                readAt: null,
              },
              {
                uuid: 'story-4',
                title: 'Rainy Saturday',
                cefrLevel: 'A2',
                createdAt: '2026-04-08T10:00:00Z',
                preview: 'A cozy indoor day with books, music, and soup.',
                wordCount: 216,
                groupKey: 'daily_life',
                groupTitle: 'Daily Life',
                isRead: false,
                readAt: null,
              },
            ],
            nextCursor: null,
            totalCount: 4,
            levelCounts: { A1: 1, A2: 2, B1: 1 },
          };
        }

        return {
          group: {
            id: 1,
            key: 'daily_life',
            order: 1,
            storyCount: 4,
            title: 'Daily Life',
          },
          stories: [
            {
              uuid: 'story-1',
              title: 'Morning Coffee',
              cefrLevel: 'A1',
              createdAt: '2026-04-11T10:00:00Z',
              preview: 'Ida opens the window and starts the day with coffee.',
              wordCount: 245,
              groupKey: 'daily_life',
              groupTitle: 'Daily Life',
              isRead: false,
              readAt: null,
            },
          ],
          nextCursor: 'cursor-2',
          totalCount: 4,
          levelCounts: { A1: 1, A2: 2, B1: 1 },
        };
      },
    );

    renderPage();

    expect(
      await screen.findByText('Showing 1 of 4 stories'),
    ).toBeInTheDocument();

    await act(async () => {
      intersectionCallback?.([{ isIntersecting: true }]);
    });

    expect(await screen.findByText('Rainy Saturday')).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 4 stories')).toBeInTheDocument();
    expect(screen.getAllByText('Morning Coffee')).toHaveLength(1);
  });
});
