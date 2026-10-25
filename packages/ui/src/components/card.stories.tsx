import type { Meta, StoryObj } from '@storybook/react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Row } from './row';
import { Text } from './text';

const meta = {
  title: 'Design system/Surfaces/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <Card>
        <Text size="medium" tone="subtle">
          Card content goes here.
        </Text>
      </Card>
    </div>
  ),
};

export const PaddingScale: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      {(['none', 'compact', 'default', 'roomy'] as const).map((padding) => (
        <Card key={padding} padding={padding}>
          <Text size="medium" tone="subtle">
            padding={padding}
          </Text>
        </Card>
      ))}
    </div>
  ),
};

export const Surfaces: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      {(['default', 'solid', 'warning', 'danger'] as const).map((surface) => (
        <Card key={surface} surface={surface}>
          <Text size="medium">surface={surface}</Text>
        </Card>
      ))}
    </div>
  ),
};

export const ClippedRows: Story = {
  render: () => (
    <div className="w-80">
      <Card clipContent padding="none">
        <Row insetFocusRing selected>
          Selected word
        </Row>
        <Row insetFocusRing>Another word</Row>
      </Card>
    </div>
  ),
};

export const Composed: Story = {
  render: () => (
    <div className="w-96">
      <Card>
        <CardHeader>
          <CardTitle size="section">Norwegian A2</CardTitle>
          <CardDescription>12 lessons · 4 completed</CardDescription>
        </CardHeader>
        <CardContent>
          <Text size="medium" tone="subtle">
            Keep going to finish this level.
          </Text>
        </CardContent>
        <CardFooter divided>
          <Text size="medium" tone="subtle">
            Next: Hos legen
          </Text>
        </CardFooter>
      </Card>
    </div>
  ),
};
