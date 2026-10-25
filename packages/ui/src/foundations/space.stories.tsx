import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import { Heading } from '../components/heading';
import { Text } from '../components/text';
import {
  ELEVATION_SECTION,
  LAYOUT_SECTION,
  RADIUS_SECTION,
} from './token-docs';
import { resolveToken } from './token-source';
import { TokenSectionTable } from './token-table';

const SPACING_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

const RADIUS_SCALE = [
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-4xl',
];

function RadiusSample({ token }: { token: string }) {
  return (
    <div
      className="size-10 border border-default bg-raised"
      style={{ borderRadius: `var(${token})` }}
    />
  );
}

function ShadowSample({ token }: { token: string }) {
  return (
    <div
      className="size-10 rounded-md bg-raised"
      style={{ boxShadow: `var(${token})` }}
    />
  );
}

function SpacingScale() {
  const spacing = resolveToken('--spacing');
  return (
    <section className="grid gap-2">
      <Heading as="h2" size="small">
        Spacing
      </Heading>
      <Text as="p" size="medium" tone="subtle">
        <Text as="code" font="mono" size="medium">
          --spacing
        </Text>{' '}
        — use when setting gaps, padding or margins.
      </Text>
      <Text as="p" size="medium" tone="subtle">
        Flyt uses Tailwind’s spacing step in multiples. The step resolves to{' '}
        <span data-resolved={spacing}>{spacing}</span> here.
      </Text>
      <div className="grid gap-2 pt-2">
        {SPACING_STEPS.map((step) => (
          <div className="flex items-center gap-4" key={step}>
            <div className="w-8">
              <Text as="code" font="mono" size="small">
                {step}
              </Text>
            </div>
            <div
              className="h-3 rounded-sm bg-[var(--border-selected)]"
              style={{ width: `calc(var(--spacing) * ${step})` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function RadiusScale() {
  return (
    <div className="flex flex-wrap gap-4 pt-2">
      {RADIUS_SCALE.map((radius) => (
        <div className="grid justify-items-center gap-1" key={radius}>
          <div
            className={`size-14 border border-default bg-raised ${radius}`}
          />
          <Text as="code" font="mono" size="small">
            {radius}
          </Text>
        </div>
      ))}
    </div>
  );
}

function SpacePage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-10">
      <SpacingScale />
      <div className="grid gap-2">
        <TokenSectionTable Specimen={RadiusSample} section={RADIUS_SECTION} />
        <RadiusScale />
      </div>
      <TokenSectionTable Specimen={ShadowSample} section={ELEVATION_SECTION} />
      <TokenSectionTable section={LAYOUT_SECTION} />
    </div>
  );
}

const meta = {
  title: 'Foundations/Spacing, radius and elevation',
  component: SpacePage,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SpacePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpacingRadiusAndElevation: Story = {
  play: async ({ canvasElement }) => {
    const resolvedValues = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-resolved]'),
    ].map((cell) => cell.dataset.resolved);

    await expect(resolvedValues.length).toBeGreaterThan(0);
    await expect(resolvedValues).not.toContain('');
  },
};
