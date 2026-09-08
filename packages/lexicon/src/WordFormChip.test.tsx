import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WordFormChip } from './WordFormChip';

describe('WordFormChip', () => {
  it('renders word form', () => {
    render(<WordFormChip form="hunder" tags={['plural']} />);
    expect(screen.getByText('hunder')).toBeInTheDocument();
  });

  it('shows tags in tooltip', () => {
    render(<WordFormChip form="hunden" tags={['definite', 'singular']} />);
    const chip = screen.getByTitle('definite, singular');
    expect(chip).toHaveAttribute('title', 'definite, singular');
  });

  it('applies default variant styles', () => {
    render(<WordFormChip form="hunder" tags={['plural']} />);
    const chip = screen.getByTitle('plural');
    expect(chip).toHaveClass('bg-secondary/30');
  });

  it('applies highlight variant styles', () => {
    render(
      <WordFormChip form="hunden" tags={['definite']} variant="highlight" />,
    );
    const chip = screen.getByTitle('definite');
    expect(chip).toHaveClass('bg-primary/15');
  });

  it('should display word form and gender badge', () => {
    render(<WordFormChip form="stikkrenna" tags={['Fem', 'Sing', 'Def']} />);

    expect(screen.getByText('stikkrenna')).toBeInTheDocument();
    // Gender badge now shows the Norwegian article (Fem → ei).
    expect(screen.getByText('ei')).toBeInTheDocument();
  });

  it('should display other tags without gender', () => {
    render(<WordFormChip form="stikkrenna" tags={['Fem', 'Sing', 'Def']} />);

    expect(screen.getByText(/Sing/)).toBeInTheDocument();
    expect(screen.getByText(/Def/)).toBeInTheDocument();
  });

  it('should handle word form without gender', () => {
    render(<WordFormChip form="running" tags={['Pres', 'Cont']} />);

    expect(screen.getByText('running')).toBeInTheDocument();
  });
});
