import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

function renderPopover(props: Record<string, unknown> = {}) {
  render(
    <Popover open>
      <PopoverTrigger>Model</PopoverTrigger>
      <PopoverContent {...props}>Pick a model</PopoverContent>
    </Popover>,
  );
  return screen.getByText('Pick a model');
}

describe('PopoverContent', () => {
  it('test_popover_content_given_trigger_width_and_scroll_expect_matching_geometry', () => {
    const content = renderPopover({ width: 'trigger', scroll: true });
    expect(content).toHaveClass('w-[var(--radix-popover-trigger-width)]');
    expect(content).toHaveClass('overflow-y-auto');
  });

  it('test_popover_content_given_menu_width_and_overlay_layer_expect_matching_classes', () => {
    const content = renderPopover({ layer: 'overlay', width: 'compact' });
    expect(content).toHaveClass('z-[60]');
    expect(content).toHaveClass('w-[min(18rem,calc(100vw-24px))]');
  });

  it('test_popover_content_given_panel_width_expect_the_extension_popup_geometry', () => {
    const content = renderPopover({ width: 'panel', padding: 'none' });
    expect(content).toHaveClass('w-[min(440px,calc(100vw-20px))]');
    expect(content).toHaveClass('max-[360px]:w-[calc(100vw-12px)]');
    expect(content).toHaveClass('p-0');
  });
});

describe('DialogContent', () => {
  it('test_dialog_content_given_modal_variant_expect_single_desktop_width', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete card?</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveClass(
      'sm:max-w-[var(--dialog-desktop-max-width)]',
    );
  });

  it('test_dialog_content_given_sheet_variant_expect_tall_scrolling_panel', () => {
    render(
      <Dialog open>
        <DialogContent padding="compact" variant="sheet">
          <DialogTitle>Import text</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByRole('dialog');
    expect(content).toHaveClass('max-h-[var(--sheet-max-height-tall)]');
    expect(content).toHaveClass('p-5');
  });
});
