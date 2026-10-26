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

function story(index: number, isRead = false) {
  return {
    uuid: `story-${index}`,
    title: `En dag i Norge ${index}`,
    cefrLevel: 'A1',
    createdAt: '2026-10-07T10:00:00',
    wordCount: 312,
    readingMinutes: 3,
    isRead,
    completed: isRead,
  };
}
function section(stories = [story(1)], storyCount = stories.length) {
  return {
    group: {
      id: 1,
      key: 'everyday',
      order: 1,
      title: 'Everyday Norwegian',
      storyCount,
    },
    stories,
  };
}
function imported(
  index: number,
  status: 'ready' | 'failed' | 'pending' | 'processing' = 'ready',
) {
  return {
    id: `import-${index}`,
    storyUuid: `imported-${index}`,
    title: `Min artikkel ${index}`,
    sourceUrl: null,
    status,
    errorCode: null,
    errorMessage: null,
    pageCount: 2,
    wordCount: 410,
    createdAt: '2026-10-07T10:00:00',
  };
}

describe('ReadingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listImports.mockResolvedValue({
      items: [],
      nextCursor: null,
      quota: { used: 0, limit: 200 },
    });
  });

  it('test_library_given_empty_sections_expect_reading_heading_and_no_empty_shelves', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [section([])],
    });
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'No stories available yet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Reading' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Everyday Norwegian' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Generate a story' }),
    ).toHaveAttribute('href', '/reading/generate');
  });

  it('test_library_given_new_learner_and_imported_everyday_group_expect_one_start_here_story', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [section([story(1), story(2)])],
    });
    renderPage();
    expect(await screen.findByText('Start here')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Start reading' })).toHaveLength(
      1,
    );
    expect(screen.getByRole('link', { name: 'Start reading' })).toHaveAttribute(
      'href',
      '/reading/story/story-1',
    );
    expect(screen.queryByText('Continue reading')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Import it' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Your imports' }),
    ).not.toBeInTheDocument();
  });

  it('test_library_given_mixed_story_lengths_expect_shortest_everyday_a1_starter', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: { ...story(1), wordCount: 1_300_000 },
      sections: [
        section([
          { ...story(1), wordCount: 1_300_000 },
          { ...story(2), wordCount: 312 },
          { ...story(3), wordCount: 112, readingMinutes: 2 },
          { ...story(4), cefrLevel: 'A2', wordCount: 50 },
        ]),
        {
          ...section([{ ...story(5), wordCount: 10 }]),
          group: { ...section().group, id: 2, key: 'nature', title: 'Nature' },
        },
      ],
    });
    renderPage();
    expect(
      await screen.findByRole('link', { name: 'Start reading' }),
    ).toHaveAttribute('href', '/reading/story/story-3');
    expect(
      screen.getByText('2 min · 112 words · Everyday Norwegian'),
    ).toBeInTheDocument();
  });

  it.each([
    { isRead: true, completed: false },
    { isRead: false, completed: true },
  ])(
    'test_library_given_read_or_completed_story_expect_no_starter',
    async (flags) => {
      getReadingHome.mockResolvedValue({
        todaysStory: story(1),
        sections: [section([story(1), { ...story(2), ...flags }])],
      });
      renderPage();
      await screen.findByRole('button', { name: 'Import it' });
      expect(screen.queryByText('Start here')).not.toBeInTheDocument();
      expect(screen.queryByText('Continue reading')).not.toBeInTheDocument();
    },
  );

  it.each(['ready', 'failed', 'pending', 'processing'] as const)(
    'test_library_given_existing_import_expect_no_starter',
    async (status) => {
      getReadingHome.mockResolvedValue({
        todaysStory: story(1),
        sections: [section([story(1)])],
      });
      listImports.mockResolvedValue({
        items: [imported(1, status)],
        nextCursor: null,
        quota: { used: 1, limit: 200 },
      });
      renderPage();
      await screen.findByRole('button', { name: 'Your imports' });
      expect(screen.queryByText('Start here')).not.toBeInTheDocument();
    },
  );

  it.each(['pending', 'failed'])(
    'test_library_given_unconfirmed_imports_expect_no_starter',
    async (state) => {
      getReadingHome.mockResolvedValue({
        todaysStory: story(1),
        sections: [section([story(1)])],
      });
      if (state === 'pending') {
        listImports.mockImplementation(() => new Promise(() => {}));
      } else {
        listImports.mockRejectedValue(new Error('imports failed'));
      }
      renderPage();
      await screen.findByRole('heading', { name: 'En dag i Norge 1' });
      expect(screen.queryByText('Start here')).not.toBeInTheDocument();
    },
  );

  it('test_library_given_no_everyday_a1_story_expect_no_starter', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: story(1),
      sections: [section([{ ...story(1), cefrLevel: 'A2' }])],
    });
    renderPage();
    await screen.findByRole('button', { name: 'Import it' });
    expect(screen.queryByText('Start here')).not.toBeInTheDocument();
  });

  it('test_library_given_empty_list_and_full_quota_expect_disabled_import_with_reason', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [section([story(1)])],
    });
    listImports.mockResolvedValue({
      items: [],
      nextCursor: null,
      quota: { used: 200, limit: 200 },
    });
    renderPage();
    const importButton = await screen.findByRole('button', {
      name: 'Import it',
    });
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAccessibleDescription(
      'You have 200 imports. Delete one to free a slot.',
    );
    expect(screen.queryByText('Start here')).not.toBeInTheDocument();
  });

  it('test_library_given_deleted_import_expect_no_starter', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [section([story(1)])],
    });
    listImports.mockResolvedValue({
      items: [],
      nextCursor: null,
      quota: { used: 1, limit: 200 },
    });
    renderPage();
    await screen.findByRole('button', { name: 'Import it' });
    expect(screen.queryByText('Start here')).not.toBeInTheDocument();
  });

  it('test_library_given_full_quota_expect_disabled_import_with_reason_and_no_starter', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [section([story(1), story(2, true)])],
    });
    listImports.mockResolvedValue({
      items: Array.from({ length: 200 }, (_, index) => imported(index)),
      nextCursor: null,
      quota: { used: 200, limit: 200 },
    });
    renderPage();
    const importButton = await screen.findByRole('button', {
      name: 'Import text',
    });
    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAccessibleDescription(
      'You have 200 imports. Delete one to free a slot.',
    );
    expect(
      screen.getByText('You have 200 imports. Delete one to free a slot.'),
    ).toBeVisible();
    expect(screen.queryByText('Start here')).not.toBeInTheDocument();
  });

  it('test_library_given_one_finished_story_expect_finished_row_without_view_all', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [section([story(1, true)])],
    });
    renderPage();
    expect(await screen.findByText('Finished')).toBeInTheDocument();
    expect(screen.queryByText('Start here')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /View all/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("You've read every story Flyt has so far."),
    ).toBeInTheDocument();
  });

  it('test_library_given_large_theme_expect_formatted_counted_view_all_and_available_metadata', async () => {
    getReadingHome.mockResolvedValue({
      todaysStory: null,
      sections: [
        section(
          Array.from({ length: 6 }, (_, index) => story(index, true)),
          1208,
        ),
      ],
    });
    renderPage();
    expect(
      await screen.findByRole('link', { name: 'View all 1,208' }),
    ).toHaveAttribute('href', '/reading/themes/everyday');
    expect(screen.getAllByText('312 words')).toHaveLength(6);
    expect(screen.getAllByText('7 Oct')).toHaveLength(6);
    expect(screen.queryByText(/% known/)).not.toBeInTheDocument();
  });

  it('test_library_given_failed_imports_expect_one_review_line_and_collapsible_shelf', async () => {
    const user = userEvent.setup();
    getReadingHome.mockResolvedValue({ todaysStory: null, sections: [] });
    listImports.mockResolvedValue({
      items: [
        imported(1, 'failed'),
        imported(2, 'failed'),
        imported(3),
        imported(4),
      ],
      nextCursor: null,
      quota: { used: 4, limit: 200 },
    });
    renderPage();
    expect(await screen.findByText('2 imports failed ·')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/reading/imports',
    );
    expect(
      screen.queryByRole('button', { name: 'Retry' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View all 4' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Your imports' }));
    expect(
      screen.queryByRole('link', { name: /Min artikkel 3/ }),
    ).not.toBeInTheDocument();
  });

  it('test_library_given_failed_home_request_expect_retry', async () => {
    getReadingHome.mockRejectedValue(new Error('home failed'));
    renderPage();
    expect(
      await screen.findByText('Could not load reading.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
