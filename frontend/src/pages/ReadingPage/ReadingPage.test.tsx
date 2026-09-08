import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ReadingPage } from './ReadingPage';

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

const { getReadingHome, listImports, createPasteImport } = vi.hoisted(() => ({
  getReadingHome: vi.fn(),
  listImports: vi.fn(),
  createPasteImport: vi.fn(),
}));

vi.mock('@/api/reading', () => ({
  getReadingHome,
}));

vi.mock('@/api/imports', () => ({
  listImports,
  createPasteImport,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReadingPage />
    </QueryClientProvider>,
  );
}

describe('ReadingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty imports list so existing tests don't render a shelf.
    listImports.mockResolvedValue({
      items: [],
      nextCursor: null,
      quota: { used: 0, limit: 10 },
    });
    createPasteImport.mockResolvedValue({
      id: 'new-import',
      storyUuid: 'story-new',
      title: 'New import',
      sourceUrl: null,
      status: 'pending',
      errorCode: null,
      errorMessage: null,
      pageCount: null,
      wordCount: 0,
      createdAt: '2026-07-20T10:00:00Z',
    });
  });

  it("renders today's story and theme shelves", async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: {
        uuid: 'story-1',
        title: 'Morning Coffee',
        groupTitle: 'Daily Life',
        cefrLevel: 'A1',
        preview: 'Hero preview fallback',
      },
      sections: [
        {
          group: {
            id: 1,
            key: 'daily_life',
            order: 1,
            storyCount: 2,
            title: 'Daily Life',
          },
          stories: [
            {
              uuid: 'story-1',
              title: 'Morning Coffee',
              cefrLevel: 'A1',
              createdAt: '2026-04-11T10:00:00Z',
              preview: 'A quick preview',
              wordCount: 245,
              isRead: false,
            },
            {
              uuid: 'story-2',
              title: 'On the Tram',
              cefrLevel: 'A2',
              createdAt: '2026-04-10T10:00:00Z',
              preview: 'A short commute turns into a tiny language lesson.',
              wordCount: 312,
              isRead: true,
            },
          ],
        },
        {
          group: {
            id: 2,
            key: 'food_dining',
            order: 2,
            storyCount: 1,
            title: 'Food & Dining',
          },
          stories: [
            {
              uuid: 'story-3',
              title: 'At the Bakery',
              cefrLevel: 'B1',
              createdAt: '2026-04-09T10:00:00Z',
              preview: 'Fresh bread, sweet buns, and a quick conversation.',
              wordCount: 278,
              isRead: false,
            },
          ],
        },
      ],
    });

    renderPage();

    expect(await screen.findByText("Today's Story")).toBeInTheDocument();
    expect(screen.getByText('Hero preview fallback')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Start reading' })).toHaveAttribute(
      'href',
      '/reading/story/story-1',
    );
    expect(
      screen.getByRole('heading', { name: 'Daily Life' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Food & Dining' }),
    ).toBeInTheDocument();
    // story-2 is read but not completed -> "In progress"; unread stories show no chip.
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'View all' })[0],
    ).toHaveAttribute('href', '/reading/themes/daily_life');
    expect(screen.getByRole('link', { name: /On the Tram/i })).toHaveAttribute(
      'href',
      '/reading/story/story-2',
    );
  });

  it('shows the empty state when there are no hero or theme stories', async () => {
    getReadingHome.mockResolvedValue({ todaysStory: null, sections: [] });

    renderPage();

    expect(
      await screen.findByText('No stories available yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Check back soon!')).toBeInTheDocument();
  });

  it('shows the empty state when all returned theme sections are empty', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [
        {
          group: {
            id: 1,
            key: 'daily_life',
            order: 1,
            storyCount: 0,
            title: 'Daily Life',
          },
          stories: [],
        },
        {
          group: {
            id: 2,
            key: 'food_dining',
            order: 2,
            storyCount: 0,
            title: 'Food & Dining',
          },
          stories: [],
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByText('No stories available yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Check back soon!')).toBeInTheDocument();
  });

  it('shows a retryable error when the home request fails', async () => {
    getReadingHome.mockRejectedValue(new Error('home failed'));

    renderPage();

    expect(
      await screen.findByText('Could not load reading.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('test_reading_home_given_user_has_imports_expect_your_imports_shelf_with_view_all', async () => {
    // D-005: the "Your imports" shelf sits between the hero and the curated
    // theme shelves. Header carries + Import text and View all →.
    getReadingHome.mockResolvedValue({
      todaysStory: {
        uuid: 'story-1',
        title: 'Morning Coffee',
        groupTitle: 'Daily Life',
        cefrLevel: 'A1',
        preview: 'Hero preview',
      },
      sections: [],
    });
    listImports.mockResolvedValue({
      items: [
        {
          id: 'import-1',
          storyUuid: 'story-imported',
          title: 'My imported article',
          sourceUrl: null,
          status: 'ready',
          errorCode: null,
          errorMessage: null,
          pageCount: 3,
          wordCount: 410,
          createdAt: '2026-07-18T10:00:00Z',
        },
      ],
      nextCursor: null,
      quota: { used: 1, limit: 10 },
    });

    renderPage();

    // Renders only after the list loads, so it also clears the shelf skeleton.
    expect(
      await screen.findByRole('link', { name: /View all/i }),
    ).toHaveAttribute('href', '/reading/imports');
    expect(
      screen.getByRole('heading', { name: 'Your imports' }),
    ).toBeInTheDocument();
    // + Import text entry point.
    expect(
      screen.getByRole('button', { name: /Import text/i }),
    ).toBeInTheDocument();
    // The ready import renders a tappable link to the reader.
    expect(
      screen.getByRole('link', { name: /My imported article/i }),
    ).toHaveAttribute('href', '/reading/story/story-imported');
  });

  it('test_reading_home_given_first_time_no_imports_expect_import_text_cta_only', async () => {
    // First-time empty state on the home: just the + Import text CTA and
    // a short explainer; no shelf (D-005). Curated sections still render
    // their own View-all links, so we assert against the imports section
    // by looking for the import CTA + empty hint, not the absence of links.
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [
        {
          group: {
            id: 1,
            key: 'daily_life',
            order: 1,
            storyCount: 1,
            title: 'Daily Life',
          },
          stories: [
            {
              uuid: 'story-1',
              title: 'Morning Coffee',
              cefrLevel: 'A1',
              createdAt: '2026-04-11T10:00:00Z',
              preview: 'A quick preview',
              wordCount: 245,
              isRead: false,
            },
          ],
        },
      ],
    });
    // Default empty imports list from beforeEach.

    renderPage();

    // ImportHomeShelf's empty hint, which also clears the skeleton.
    expect(
      await screen.findByText(
        /Paste an article, transcript, or notes in Norwegian/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Your imports' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Import text/i }),
    ).toBeInTheDocument();
    // No ready import card link appears when the user has no imports.
    expect(
      screen.queryByRole('link', { name: /Imported article/i }),
    ).not.toBeInTheDocument();
  });

  it('test_reading_home_given_import_button_click_expect_paste_sheet_opens', async () => {
    const user = userEvent.setup();
    getReadingHome.mockResolvedValue({ todaysStory: null, sections: [] });

    renderPage();

    const importButton = await screen.findByRole('button', {
      name: /Import text/i,
    });
    await user.click(importButton);

    // The paste sheet's textarea becomes visible.
    expect(
      await screen.findByPlaceholderText('Paste text here…'),
    ).toBeInTheDocument();
  });

  it('test_reading_home_given_imports_fetch_fails_expect_shelf_hidden', async () => {
    // A failed preview fetch on the home must not break the home; the
    // curated sections keep rendering. The shelf renders nothing.
    getReadingHome.mockResolvedValue({ todaysStory: null, sections: [] });
    listImports.mockRejectedValue(new Error('imports down'));

    renderPage();

    // Wait for the curated empty state so the home has settled.
    expect(
      await screen.findByText('No stories available yet.'),
    ).toBeInTheDocument();
    // No "Your imports" shelf header (it renders nothing on error).
    expect(
      screen.queryByRole('heading', { name: 'Your imports' }),
    ).not.toBeInTheDocument();
  });
});
