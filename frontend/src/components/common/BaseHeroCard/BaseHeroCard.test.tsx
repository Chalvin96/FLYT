import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BaseHeroCard } from './BaseHeroCard';

describe('BaseHeroCard', () => {
  it('renders core content and wrapper-provided classes', () => {
    render(
      <BaseHeroCard
        className="bg-primary-70 text-white-100"
        label="Ready now"
        labelClass="text-white-60"
        badge="Focus mode"
        badgeClass="bg-white-20 text-white-100"
        title="Your review queue"
        subtitle="10 cards · ~3 min session"
        subtitleClass="text-white-70"
        primaryAction={<button type="button">Start review</button>}
      />,
    );

    expect(screen.getByText('Ready now')).toBeInTheDocument();
    expect(screen.getByText('Focus mode')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Your review queue' }),
    ).toBeInTheDocument();
    expect(screen.getByText('10 cards · ~3 min session')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start review' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('hero-card')).toHaveStyle({ opacity: '0' });
  });

  it('renders optional chip, decoration, secondary action, and progress semantics', () => {
    render(
      <BaseHeroCard
        className="bg-secondary-70 text-white-100"
        label="A1 · Basics"
        labelClass="text-white-60"
        badge="Up next"
        badgeClass="bg-white-20 text-white-100"
        title="Alphabet"
        subtitle="Intro lesson"
        subtitleClass="text-white-70"
        decoration={<span>Decoration</span>}
        primaryAction={<button type="button">Start this lesson</button>}
        secondaryAction={<button type="button">Quick session</button>}
        chip={{
          label: '2 of 4 lessons',
          className: 'bg-black-10 text-white-70',
        }}
        progress={{ current: 2, total: 4, showBar: true, showPercentage: true }}
      />,
    );

    expect(screen.getByText('Decoration')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 lessons')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quick session' }),
    ).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar', {
      name: 'Lesson progress',
    });
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '4');
    expect(progressBar).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByTestId('hero-bar-fill')).toHaveStyle({
      transform: 'scaleX(0.5)',
    });
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 lessons completed')).toHaveClass('sr-only');
  });

  it('hides optional elements when omitted', () => {
    render(
      <BaseHeroCard
        className="bg-secondary-20 text-foreground"
        label="All done"
        labelClass="text-secondary-60"
        badge="Rest mode"
        badgeClass="bg-black-10 text-secondary-70"
        title="You are all caught up"
        subtitle="Nothing due right now"
        subtitleClass="text-muted-foreground"
        primaryAction={<button type="button">Go reading</button>}
      />,
    );

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/lessons completed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Quick session' }),
    ).not.toBeInTheDocument();
  });
});
