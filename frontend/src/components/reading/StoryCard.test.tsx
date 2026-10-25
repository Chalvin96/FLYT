import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouterProvider } from '@tanstack/react-router';

import { createStoryRouter } from '@/test/router';
import type { ReadingStorySummary } from '@/types/api';

import { StoryCard } from './StoryCard';

const story: ReadingStorySummary = {
  uuid: 'story-1',
  title: 'Nøkkelen til det gamle huset',
  cefrLevel: 'A1',
  createdAt: '2026-09-24T23:00:00',
  wordCount: 320,
  readingMinutes: 3,
  isRead: false,
  completed: false,
};

function renderCard(overrides: Partial<ReadingStorySummary> = {}) {
  const router = createStoryRouter(
    <StoryCard story={{ ...story, ...overrides }} />,
    ['/'],
    ['/reading/story/$uuid'],
  );
  render(<RouterProvider router={router} />);
}

describe('StoryCard', () => {
  it('test_story_row_given_api_story_expect_link_level_duration_words_and_date', async () => {
    renderCard();
    const link = await screen.findByRole('link', { name: /Nøkkelen/ });
    expect(link).toHaveAttribute('href', '/reading/story/story-1');
    expect(within(link).getByText('A1')).toBeInTheDocument();
    expect(link).toHaveTextContent('3 min · 320 words · 24 Sept');
  });

  it('test_story_row_given_backend_reading_minutes_expect_minutes_from_api', async () => {
    renderCard({ wordCount: 320, readingMinutes: 9 });
    const link = await screen.findByRole('link', { name: /Nøkkelen/ });
    expect(link).toHaveTextContent('9 min · 320 words · 24 Sept');
  });

  it('test_story_row_given_long_title_expect_full_title_and_norwegian_language', async () => {
    const title =
      'Hvorfor nordmenn elsker å gå på tur i all slags vær, selv når det regner sidelengs og vinden river i jakka hele veien opp';
    renderCard({ title });
    const heading = await screen.findByRole('heading', { name: title });
    expect(heading).toHaveAttribute('lang', 'nb');
    expect(heading).toHaveAttribute('title', title);
    expect(
      screen.getByRole('link', { name: new RegExp(title) }),
    ).toHaveAttribute('title', title);
  });

  it('test_story_row_given_finished_story_expect_finished_status', async () => {
    renderCard({ isRead: true, completed: true });
    expect(await screen.findByText('Finished')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('test_story_row_given_started_story_expect_in_progress_status', async () => {
    renderCard({ isRead: true });
    const link = await screen.findByRole('link', { name: /Nøkkelen/ });
    expect(link).toHaveTextContent('In progress');
  });

  it('test_story_row_given_million_word_count_expect_compact_count_with_exact_title', async () => {
    renderCard({ wordCount: 1_300_000 });
    expect(await screen.findByText('1.3M words')).toHaveAttribute(
      'title',
      '1,300,000 words',
    );
  });

  it('test_story_row_given_no_level_and_no_word_count_expect_no_level_or_duration', async () => {
    renderCard({ cefrLevel: null, wordCount: 0, readingMinutes: 0 });
    await screen.findByRole('link');
    expect(screen.queryByText('A1')).not.toBeInTheDocument();
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });
});
