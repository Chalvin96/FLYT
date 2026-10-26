import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import { Text } from '../components/text';
import { COLOUR_SECTIONS } from './token-docs';
import { resolveToken } from './token-source';
import { TokenSectionTable } from './token-table';

function Swatch({ token }: { token: string }) {
  return (
    <div
      className="size-10 rounded-md border border-default"
      style={{ background: `var(${token})` }}
    />
  );
}

function ColourPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-10">
      <Text as="p" size="medium" tone="subtle">
        Components name a meaning, never a palette step. Each row shows the
        token, the step or recipe it is written as in the shared stylesheet, and
        the value it resolves to on this page.
      </Text>
      {COLOUR_SECTIONS.map((section) => (
        <TokenSectionTable
          key={section.title}
          section={section}
          Specimen={Swatch}
        />
      ))}
    </div>
  );
}

const meta = {
  title: 'Foundations/Colour',
  component: ColourPage,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ColourPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colour: Story = {
  play: async ({ canvasElement }) => {
    const rows = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-token]'),
    ];
    const unresolved = rows
      .filter((row) => resolveToken(row.dataset.token ?? '') === '')
      .map((row) => row.dataset.token);

    await expect(rows.length).toBeGreaterThan(0);
    await expect(unresolved).toEqual([]);
  },
};
