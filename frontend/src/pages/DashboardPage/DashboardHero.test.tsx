import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppNavbarPreview } from '@/components/router/AppNavbar/AppNavbarPreview';

import { DashboardHero } from './DashboardHero';

const baseProps = {
  dueCount: 10,
  streak: 4,
  lessonsHref: '/lesson',
  reviewHref: '/review',
};

describe('DashboardHero', () => {
  it('renders review state with computed session estimate', async () => {
    render(
      <AppNavbarPreview>
        <DashboardHero {...baseProps} state="review" />
      </AppNavbarPreview>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Your review queue' }),
    ).toBeInTheDocument();
    expect(screen.getByText('10 cards · ~3 min session')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start review' })).toHaveAttribute(
      'href',
      '/review',
    );
  });

  it('renders risk state with streak chip and quick session action', async () => {
    render(
      <AppNavbarPreview>
        <DashboardHero {...baseProps} state="risk" />
      </AppNavbarPreview>,
    );

    expect(
      await screen.findByText('Review before midnight'),
    ).toBeInTheDocument();
    expect(screen.getByText('4-day streak')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Quick session ->' }),
    ).toBeInTheDocument();
  });

  it('renders lessons state and hides streak chip', async () => {
    render(
      <AppNavbarPreview>
        <DashboardHero {...baseProps} state="lessons" />
      </AppNavbarPreview>,
    );

    expect(
      await screen.findByText('New lesson in your path'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open lessons' })).toHaveAttribute(
      'href',
      '/lesson',
    );
    expect(screen.queryByText('4-day streak')).not.toBeInTheDocument();
  });

  it('renders done state and hides streak chip when streak is zero', async () => {
    render(
      <AppNavbarPreview>
        <DashboardHero {...baseProps} streak={0} state="done" />
      </AppNavbarPreview>,
    );

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByText(/day streak/i)).not.toBeInTheDocument();
  });

  it('renders empty state with welcome copy', async () => {
    render(
      <AppNavbarPreview>
        <DashboardHero {...baseProps} state="empty" />
      </AppNavbarPreview>,
    );

    const heading = await screen.findByText('Welcome to Flyt!');
    expect(heading).toBeInTheDocument();
    expect(screen.getByTestId('hero-card-section')).toHaveClass(
      'bg-secondary-10',
      'border-dashed',
      'border-secondary-30',
    );
    expect(
      screen.getByRole('link', { name: 'Start first lesson' }),
    ).toHaveAttribute('href', '/lesson');
  });
});
