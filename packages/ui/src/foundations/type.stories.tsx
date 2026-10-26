import type { Meta, StoryObj } from '@storybook/react';
import type { ReactElement } from 'react';
import { expect } from 'storybook/test';

import { Heading } from '../components/heading';
import { Text } from '../components/text';
import { TYPE_ROLE_DOCS, TYPE_SECTIONS } from './token-docs';
import { resolveToken } from './token-source';
import { TokenSectionTable } from './token-table';

const meta = {
  title: 'Foundations/Type',
  component: Text,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

const ROLE_SAMPLES: Record<string, ReactElement> = {
  '--text-body-small': (
    <Text size="small">Added 3 days ago · 12 words · A2 level</Text>
  ),
  '--text-body-medium': (
    <Text size="medium">
      Your review queue is ready. Six cards are due today, and two are new words
      from yesterday&apos;s story.
    </Text>
  ),
  '--text-body-large': (
    <Text size="large">
      Write two sentences about your weekend. Try to use at least one past-tense
      verb you learned today.
    </Text>
  ),
  '--text-body-fluid': (
    <Text size="fluid">Etter frokost tok familien toget til byen.</Text>
  ),
  '--text-heading-xxlarge': (
    <Heading as="h3" size="xxlarge">
      Read Norwegian you love
    </Heading>
  ),
  '--text-heading-xlarge': (
    <Heading as="h3" size="xlarge">
      Lesson complete
    </Heading>
  ),
  '--text-heading-large': (
    <Heading as="h3" size="large">
      Your words
    </Heading>
  ),
  '--text-heading-medium': (
    <Heading as="h3" size="medium">
      Continue reading
    </Heading>
  ),
  '--text-heading-small': (
    <Heading as="h3" size="small">
      Continue reading
    </Heading>
  ),
  '--text-heading-xsmall': (
    <Heading as="h3" size="xsmall">
      Continue reading
    </Heading>
  ),
  '--text-heading-xxsmall': (
    <Heading as="div" size="xxsmall">
      Selected text
    </Heading>
  ),
  '--text-heading-fluid': (
    <Heading as="h3" size="fluid">
      Hva heter du?
    </Heading>
  ),
};

function rootFontSize(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function inPixels(length: string): string {
  if (!length.endsWith('rem')) return length;
  return `${Number.parseFloat(length) * rootFontSize()}`;
}

function RoleMetrics({ token }: { token: string }) {
  const size = resolveToken(token);
  const lineHeight = resolveToken(`${token}--line-height`);
  const weight = resolveToken(`${token}--font-weight`);

  if (!lineHeight) {
    return (
      <Text as="span" font="mono" size="small" tone="subtle">
        <span data-resolved={size}>{size}</span>
      </Text>
    );
  }
  return (
    <Text as="span" font="mono" size="small" tone="subtle">
      <span data-resolved={size}>{inPixels(size)}</span> /{' '}
      <span data-resolved={lineHeight}>{inPixels(lineHeight)}</span> ·{' '}
      <span data-resolved={weight}>{weight}</span>
    </Text>
  );
}

function RoleTable() {
  return (
    <div className="grid">
      {TYPE_ROLE_DOCS.map((doc) => (
        <div
          className="grid gap-1 border-b border-default py-4"
          data-role-token={doc.name}
          key={doc.name}
        >
          <div className="flex items-baseline justify-between gap-4">
            <Text as="code" font="mono" size="small">
              {doc.name.replace('--text-', '')}
            </Text>
            <RoleMetrics token={doc.name} />
          </div>
          <Text as="span" size="small" tone="subtle">
            {doc.useWhen}
          </Text>
          <div data-role-specimen={doc.name} className="pt-1">
            {ROLE_SAMPLES[doc.name]}
          </div>
        </div>
      ))}
    </div>
  );
}

export const Roles: Story = {
  play: async ({ canvasElement }) => {
    const specimens = TYPE_ROLE_DOCS.map((doc) => ({
      role: doc.name,
      specimen: canvasElement.querySelector<HTMLElement>(
        `[data-role-token="${doc.name}"] [data-role-specimen]`,
      ),
    }));

    for (const { role, specimen } of specimens) {
      await expect(specimen, role).not.toBeNull();
      await expect(specimen?.childElementCount, role).toBeGreaterThan(0);
    }

    const resolvedValues = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-resolved]'),
    ].map((value) => value.dataset.resolved);

    await expect(resolvedValues).not.toContain('');
  },
  render: () => (
    <div className="mx-auto flex max-w-5xl flex-col gap-10">
      <section className="grid gap-4">
        <Heading as="h2" size="medium">
          The scale
        </Heading>
        <Text as="p" size="medium" tone="subtle">
          The scale follows Atlassian&apos;s names and values. Headings are
          bold, body text is normal, and the fluid step is the one Flyt
          addition.
        </Text>
        <RoleTable />
      </section>
      {TYPE_SECTIONS.map((section) => (
        <TokenSectionTable key={section.title} section={section} />
      ))}
    </div>
  ),
};
