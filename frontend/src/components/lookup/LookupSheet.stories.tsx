import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { useEffect, useRef } from 'react';

import { AppNavbarPreview } from '@/components/router/AppNavbar/AppNavbarPreview';

import { LookupSheet } from './LookupSheet';
import { useLookupContext } from './useLookupContext';

function OpenLookupSearchOnMount() {
  const { openSearch } = useLookupContext();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openSearch();
  }, [openSearch]);

  return null;
}

const meta = {
  title: 'Features/Lookup/LookupSheet',
  component: LookupSheet,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'desktop' },
  },
  decorators: [
    (Story) => (
      <AppNavbarPreview>
        <Story />
      </AppNavbarPreview>
    ),
  ],
  render: () => <OpenLookupSearchOnMount />,
} satisfies Meta<typeof LookupSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AnchoredUnderSearchEntry: Story = {
  play: async () => {
    const dialog = within(document.body).getByRole('dialog');
    const bounds = dialog.getBoundingClientRect();

    await expect(
      within(dialog).getByPlaceholderText('Search a Norwegian word'),
    ).toBeTruthy();
    await expect(bounds.top).toBeLessThan(window.innerHeight / 2);
  },
};
