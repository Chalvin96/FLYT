import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

function renderTooltip(props: { width?: 'auto' | 'narrow' } = {}) {
  render(
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger>Tone 1</TooltipTrigger>
        <TooltipContent {...props}>Falling pitch</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
  return screen.getAllByText('Falling pitch')[0];
}

describe('TooltipContent', () => {
  it('test_tooltip_content_given_no_width_expect_hugs_its_label', () => {
    expect(renderTooltip()).not.toHaveClass('text-center');
  });

  it('test_tooltip_content_given_narrow_width_expect_wrapped_centred_copy', () => {
    const content = renderTooltip({ width: 'narrow' });
    expect(content).toHaveClass('max-w-56');
    expect(content).toHaveClass('text-center');
  });
});
