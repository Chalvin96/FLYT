import { SearchBar } from '@flyt/lexicon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AudioPlayButton,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  Button,
  Chip,
  Heading,
  InlineTrigger,
  Text,
} from '@flyt/ui';
import type { Meta, StoryObj } from '@storybook/react';

import { AnswerOption } from '@/components/flashcard/AnswerOption/AnswerOption';
import { TokenChip } from '@/components/flashcard/TokenChip/TokenChip';

type InventoryItem = {
  name: string;
  use: string;
  owner: string;
  example: React.ReactNode;
};

const inventory: InventoryItem[] = [
  {
    name: 'General action',
    use: 'Commit, submit, cancel, retry, or navigate.',
    owner: '@flyt/ui Button',
    example: <Button>Continue lesson</Button>,
  },
  {
    name: 'Answer option',
    use: 'Select and later reveal a graded radio answer.',
    owner: 'Lesson/review AnswerOption',
    example: (
      <AnswerOption
        checked
        label="jeg ikke kan komme"
        marker="B"
        state="selected"
      />
    ),
  },
  {
    name: 'Manipulable token',
    use: 'Tap or drag a word inside a language exercise.',
    owner: 'TokenChip',
    example: <TokenChip state="selected" text="kommer" />,
  },
  {
    name: 'Content-embedded control',
    use: 'Interact with a word or example inside running content.',
    owner: 'Owning content component',
    example: <InlineTrigger current>hyggelig</InlineTrigger>,
  },
  {
    name: 'Navigation chrome',
    use: 'Move between pages, tabs, or shell panels.',
    owner: 'Owning shell component',
    example: (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#reading">Reading</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <span aria-current="page">Page 2</span>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
  },
  {
    name: 'Selection toggle',
    use: 'Turn a filter, tile, or picker value on and off.',
    owner: 'Owning feature component',
    example: <Chip pressed>A2 selected</Chip>,
  },
  {
    name: 'Disclosure trigger',
    use: 'Expand or collapse supporting content.',
    owner: 'Owning disclosure component',
    example: (
      <Accordion collapsible type="single">
        <AccordionItem value="explanation">
          <AccordionTrigger>Show explanation</AccordionTrigger>
          <AccordionContent>
            The finite verb stays in the second position.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    name: 'Media transport',
    use: 'Play, stop, retry, and clean up audio playback.',
    owner: '@flyt/ui AudioPlayButton',
    example: (
      <AudioPlayButton src="/storybook-sample.mp3" presentation="inline" />
    ),
  },
  {
    name: 'Field adornment',
    use: 'Clear or submit content inside an input boundary.',
    owner: 'Owning field component',
    example: (
      <SearchBar
        onChange={() => undefined}
        onSearch={() => undefined}
        value="norsk"
      />
    ),
  },
];

function Inventory() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="max-w-3xl">
        <Heading as="div" size="xxsmall" tone="brand">
          Control taxonomy
        </Heading>
        <div className="mt-2">
          <Heading as="h1" size="large" tone="default">
            One Button, distinct interaction primitives
          </Heading>
        </div>
        <div className="mt-3">
          <Text size="medium" tone="subtle">
            Use the general action Button only when an action commits or
            navigates. Controls with a different behavioral contract keep a
            dedicated owner.
          </Text>
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {inventory.map((item) => (
          <article
            className="radius-section flex min-h-64 flex-col border border-default bg-raised p-5 shadow-soft"
            key={item.name}
          >
            <div className="grow">
              <Heading as="h2" size="small" tone="default">
                {item.name}
              </Heading>
              <div className="mt-2">
                <Text size="medium" tone="subtle">
                  {item.use}
                </Text>
              </div>
              <div className="mt-3">
                <Text size="small" tone="subtle">
                  Owner: <strong>{item.owner}</strong>
                </Text>
              </div>
            </div>
            <div className="mt-6 flex min-h-20 items-center border-t border-default pt-5">
              {item.example}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: 'Features/Common/Control inventory',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const InventoryOverview: Story = { render: () => <Inventory /> };
