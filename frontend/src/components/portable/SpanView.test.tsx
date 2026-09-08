import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SpanView } from './SpanView';

describe('SpanView', () => {
  it('renders plain text spans', () => {
    render(<SpanView spans={[{ kind: 'text', value: 'the house' }]} />);
    expect(screen.getByText('the house')).toBeInTheDocument();
  });

  it('renders foreign terms with language metadata', () => {
    render(
      <SpanView
        spans={[{ kind: 'foreign_term', value: 'huset', lang: 'no' }]}
      />,
    );
    const element = screen.getByText('huset');
    expect(element).toHaveAttribute('lang', 'no');
    expect(element.className).toContain('foreign-term');
  });
});
