import type { Meta, StoryObj } from '@storybook/react';

import { Row } from './row';

const meta = {
  title: 'Design system/Actions/Row',
  component: Row,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { children: 'Row label' },
} satisfies Meta<typeof Row>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Row size="sm">Small row</Row>
      <Row size="md">Medium row</Row>
      <Row size="lg">Large row</Row>
    </div>
  ),
};

export const Surfaces: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Row surface="plain">Plain surface</Row>
      <Row surface="framed">Framed surface</Row>
      <Row surface="outline">Outline surface</Row>
    </div>
  ),
};

export const Inline: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Row layout="inline" size="sm" surface="outline">
        Short
      </Row>
      <Row layout="inline" size="sm" surface="outline">
        Medium
      </Row>
      <Row layout="inline" size="sm" surface="outline">
        Long
      </Row>
    </div>
  ),
};

export const Selected: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Row selected surface="plain">
        Selected plain
      </Row>
      <Row selected={false} surface="plain">
        Idle plain
      </Row>
      <Row selected surface="outline">
        Selected outline
      </Row>
      <Row selected={false} surface="outline">
        Idle outline
      </Row>
      <Row selected={false} surface="framed">
        Idle framed
      </Row>
    </div>
  ),
};

export const Unavailable: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Row aria-disabled="true" layout="inline" size="sm" surface="outline">
        Unavailable pill
      </Row>
    </div>
  ),
};
