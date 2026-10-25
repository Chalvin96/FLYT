import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { CLOSED_COMPONENTS } from '../../../../eslint.config.js';
import * as UI from '../index';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';
import { Badge } from './badge';
import { BottomSheetDialogContent } from './bottom-sheet-dialog-content';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from './breadcrumb';
import { Button } from './button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Chip } from './chip';
import { ChoiceTile } from './choice-tile';
import { AudioPlayButton } from './audio-play-button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { ErrorMessage } from './error-message';
import { Glyph } from './glyph';
import { Heading } from './heading';
import { IconWell } from './icon-well';
import { Input } from './input';
import { InlineTrigger } from './inline-trigger';
import { Modal } from './modal';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Row } from './row';
import { Separator } from './separator';
import { Skeleton } from './skeleton';
import { Text } from './text';
import { Toaster } from './sonner';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

const injected = {
  className: 'INJECTED',
  style: { color: 'red' },
} as unknown as Record<string, never>;

type Surface = {
  component: string;
  element: ReactElement;
  query: () => HTMLElement;
};

const byTestId = (component: string) => () => screen.getByTestId(component);

// One entry per closed surface: the tree it renders and the element that must
// reject the injected surface. The list drives both what is rendered and what
// the coverage test requires, so a closed component cannot be declared and left
// unexercised.
const SURFACES: Surface[] = [
  {
    component: 'Accordion',
    element: (
      <Accordion
        {...injected}
        data-testid="Accordion"
        defaultValue="one"
        type="single"
        collapsible
      />
    ),
    query: byTestId('Accordion'),
  },
  {
    component: 'AccordionItem',
    element: (
      <Accordion defaultValue="one" type="single" collapsible>
        <AccordionItem {...injected} data-testid="AccordionItem" value="one" />
      </Accordion>
    ),
    query: byTestId('AccordionItem'),
  },
  {
    component: 'AccordionTrigger',
    element: (
      <Accordion defaultValue="one" type="single" collapsible>
        <AccordionItem value="one">
          <AccordionTrigger {...injected} data-testid="AccordionTrigger" />
        </AccordionItem>
      </Accordion>
    ),
    query: byTestId('AccordionTrigger'),
  },
  {
    component: 'AccordionContent',
    element: (
      <Accordion defaultValue="one" type="single" collapsible>
        <AccordionItem value="one">
          <AccordionContent {...injected} data-testid="AccordionContent" />
        </AccordionItem>
      </Accordion>
    ),
    query: byTestId('AccordionContent'),
  },
  {
    component: 'AudioPlayButton',
    element: <AudioPlayButton {...injected} src={null} />,
    query: () => screen.getByRole('img', { name: 'Audio unavailable' }),
  },
  {
    component: 'Badge',
    element: <Badge {...injected} data-testid="Badge" />,
    query: byTestId('Badge'),
  },
  {
    component: 'Button',
    element: <Button {...injected} data-testid="Button" />,
    query: byTestId('Button'),
  },
  {
    component: 'Card',
    element: <Card {...injected} data-testid="Card" />,
    query: byTestId('Card'),
  },
  {
    component: 'CardHeader',
    element: <CardHeader {...injected} data-testid="CardHeader" />,
    query: byTestId('CardHeader'),
  },
  {
    component: 'CardTitle',
    element: <CardTitle {...injected} data-testid="CardTitle" />,
    query: byTestId('CardTitle'),
  },
  {
    component: 'CardDescription',
    element: <CardDescription {...injected} data-testid="CardDescription" />,
    query: byTestId('CardDescription'),
  },
  {
    component: 'CardContent',
    element: <CardContent {...injected} data-testid="CardContent" />,
    query: byTestId('CardContent'),
  },
  {
    component: 'CardFooter',
    element: <CardFooter {...injected} data-testid="CardFooter" />,
    query: byTestId('CardFooter'),
  },
  {
    component: 'Breadcrumb',
    element: <Breadcrumb {...injected} data-testid="Breadcrumb" />,
    query: byTestId('Breadcrumb'),
  },
  {
    component: 'BreadcrumbList',
    element: (
      <Breadcrumb>
        <BreadcrumbList {...injected} data-testid="BreadcrumbList" />
      </Breadcrumb>
    ),
    query: byTestId('BreadcrumbList'),
  },
  {
    component: 'BreadcrumbItem',
    element: (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem {...injected} data-testid="BreadcrumbItem" />
        </BreadcrumbList>
      </Breadcrumb>
    ),
    query: byTestId('BreadcrumbItem'),
  },
  {
    component: 'BreadcrumbLink',
    element: (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink {...injected} data-testid="BreadcrumbLink" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
    query: byTestId('BreadcrumbLink'),
  },
  {
    component: 'Chip',
    element: <Chip {...injected} data-testid="Chip" />,
    query: byTestId('Chip'),
  },
  {
    component: 'ChoiceTile',
    element: <ChoiceTile {...injected} data-testid="ChoiceTile" />,
    query: byTestId('ChoiceTile'),
  },
  {
    component: 'Input',
    element: <Input {...injected} data-testid="Input" />,
    query: byTestId('Input'),
  },
  {
    component: 'InlineTrigger',
    element: <InlineTrigger {...injected} data-testid="InlineTrigger" />,
    query: byTestId('InlineTrigger'),
  },
  {
    component: 'Skeleton',
    element: <Skeleton {...injected} data-testid="Skeleton" />,
    query: byTestId('Skeleton'),
  },
  {
    component: 'Text',
    element: <Text {...injected} data-testid="Text" size="medium" />,
    query: byTestId('Text'),
  },
  {
    component: 'Heading',
    element: (
      <Heading {...injected} data-testid="Heading" size="medium">
        Your words
      </Heading>
    ),
    query: byTestId('Heading'),
  },
  {
    component: 'Glyph',
    element: <Glyph {...injected} data-testid="Glyph" size="3xs" />,
    query: byTestId('Glyph'),
  },
  {
    component: 'RadioGroup',
    element: <RadioGroup {...injected} data-testid="RadioGroup" />,
    query: byTestId('RadioGroup'),
  },
  {
    component: 'RadioGroupItem',
    element: (
      <RadioGroup>
        <RadioGroupItem
          {...injected}
          data-testid="RadioGroupItem"
          value="one"
        />
      </RadioGroup>
    ),
    query: byTestId('RadioGroupItem'),
  },
  {
    component: 'Row',
    element: <Row {...injected} data-testid="Row" />,
    query: byTestId('Row'),
  },
  {
    component: 'Separator',
    element: <Separator {...injected} data-testid="Separator" />,
    query: byTestId('Separator'),
  },
  {
    component: 'Table',
    element: <Table {...injected} data-testid="Table" />,
    query: byTestId('Table'),
  },
  {
    component: 'TableCaption',
    element: (
      <Table>
        <TableCaption {...injected} data-testid="TableCaption" />
      </Table>
    ),
    query: byTestId('TableCaption'),
  },
  {
    component: 'TableHeader',
    element: (
      <Table>
        <TableHeader {...injected} data-testid="TableHeader" />
      </Table>
    ),
    query: byTestId('TableHeader'),
  },
  {
    component: 'TableBody',
    element: (
      <Table>
        <TableBody {...injected} data-testid="TableBody" />
      </Table>
    ),
    query: byTestId('TableBody'),
  },
  {
    component: 'TableRow',
    element: (
      <Table>
        <TableBody>
          <TableRow {...injected} data-testid="TableRow" />
        </TableBody>
      </Table>
    ),
    query: byTestId('TableRow'),
  },
  {
    component: 'TableHead',
    element: (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead {...injected} data-testid="TableHead" />
          </TableRow>
        </TableHeader>
      </Table>
    ),
    query: byTestId('TableHead'),
  },
  {
    component: 'TableCell',
    element: (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell {...injected} data-testid="TableCell" />
          </TableRow>
        </TableBody>
      </Table>
    ),
    query: byTestId('TableCell'),
  },
  {
    component: 'TableFooter',
    element: (
      <Table>
        <TableFooter {...injected} data-testid="TableFooter" />
      </Table>
    ),
    query: byTestId('TableFooter'),
  },
  {
    component: 'PopoverTrigger',
    element: (
      <Popover open>
        <PopoverTrigger {...injected} data-testid="PopoverTrigger" />
      </Popover>
    ),
    query: byTestId('PopoverTrigger'),
  },
  {
    component: 'PopoverAnchor',
    element: (
      <Popover open>
        <PopoverAnchor {...injected} data-testid="PopoverAnchor" />
      </Popover>
    ),
    query: byTestId('PopoverAnchor'),
  },
  {
    component: 'PopoverContent',
    element: (
      <Popover open>
        <PopoverContent {...injected} data-testid="PopoverContent" />
      </Popover>
    ),
    query: byTestId('PopoverContent'),
  },
  {
    component: 'Tabs',
    element: <Tabs {...injected} data-testid="Tabs" defaultValue="one" />,
    query: byTestId('Tabs'),
  },
  {
    component: 'TabsList',
    element: (
      <Tabs defaultValue="one">
        <TabsList {...injected} data-testid="TabsList" />
      </Tabs>
    ),
    query: byTestId('TabsList'),
  },
  {
    component: 'TabsTrigger',
    element: (
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger {...injected} data-testid="TabsTrigger" value="one" />
        </TabsList>
      </Tabs>
    ),
    query: byTestId('TabsTrigger'),
  },
  {
    component: 'TabsContent',
    element: (
      <Tabs defaultValue="one">
        <TabsContent {...injected} data-testid="TabsContent" value="one" />
      </Tabs>
    ),
    query: byTestId('TabsContent'),
  },
  {
    component: 'TooltipTrigger',
    element: (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger {...injected} data-testid="TooltipTrigger" />
        </Tooltip>
      </TooltipProvider>
    ),
    query: byTestId('TooltipTrigger'),
  },
  {
    component: 'TooltipContent',
    element: (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger />
          <TooltipContent {...injected} data-testid="TooltipContent" />
        </Tooltip>
      </TooltipProvider>
    ),
    query: byTestId('TooltipContent'),
  },
  {
    component: 'DialogTrigger',
    element: (
      <Dialog open>
        <DialogTrigger {...injected} data-testid="DialogTrigger" />
      </Dialog>
    ),
    query: byTestId('DialogTrigger'),
  },
  {
    component: 'DialogOverlay',
    element: (
      <Dialog open>
        <DialogOverlay {...injected} data-testid="DialogOverlay" />
      </Dialog>
    ),
    query: byTestId('DialogOverlay'),
  },
  {
    component: 'DialogContent',
    element: (
      <Dialog open>
        <DialogContent {...injected} data-testid="DialogContent" />
      </Dialog>
    ),
    query: byTestId('DialogContent'),
  },
  {
    component: 'DialogClose',
    element: (
      <Dialog open>
        <DialogClose {...injected} data-testid="DialogClose" />
      </Dialog>
    ),
    query: byTestId('DialogClose'),
  },
  {
    component: 'DialogHeader',
    element: (
      <Dialog open>
        <DialogHeader {...injected} data-testid="DialogHeader" />
      </Dialog>
    ),
    query: byTestId('DialogHeader'),
  },
  {
    component: 'DialogTitle',
    element: (
      <Dialog open>
        <DialogTitle {...injected} data-testid="DialogTitle" />
      </Dialog>
    ),
    query: byTestId('DialogTitle'),
  },
  {
    component: 'DialogDescription',
    element: (
      <Dialog open>
        <DialogDescription {...injected} data-testid="DialogDescription" />
      </Dialog>
    ),
    query: byTestId('DialogDescription'),
  },
  {
    component: 'DialogFooter',
    element: (
      <Dialog open>
        <DialogFooter {...injected} data-testid="DialogFooter" />
      </Dialog>
    ),
    query: byTestId('DialogFooter'),
  },
  {
    component: 'Modal',
    element: (
      <Modal {...injected} isOpen onClose={() => {}}>
        Body
      </Modal>
    ),
    query: () => screen.getByRole('dialog'),
  },
  {
    component: 'BottomSheetDialogContent',
    element: (
      <Dialog open>
        <BottomSheetDialogContent {...injected}>Sheet</BottomSheetDialogContent>
      </Dialog>
    ),
    query: () => screen.getByRole('dialog'),
  },
  {
    component: 'ErrorMessage',
    element: <ErrorMessage {...injected} error="Boom" title="Failed" />,
    query: () => screen.getByRole('alert'),
  },
  {
    component: 'IconWell',
    element: <IconWell {...injected} data-testid="IconWell" />,
    query: byTestId('IconWell'),
  },
];

// Radix roots, providers and portals: no surface of their own to close.
const RENDERLESS_EXPORTS = new Set([
  'Dialog',
  'DialogPortal',
  'Popover',
  'Tooltip',
  'TooltipProvider',
]);

// Host wrappers render only through the library that owns their markup.
// `Toaster` renders nothing until a toast is pushed, so its surface cannot be
// probed inert; its own component assigns the surface after the spread.
const HOST_RENDERED_EXPORTS = new Set(['Toaster']);

// forwardRef and memo produce objects, not functions; filtering on `function`
// alone skipped Tabs, the one export that was still open. A class is a function,
// so class declarations are dropped rather than listed as exceptions.
const CAPITALISED_NAME = /^[A-Z]/;

function isExportedComponent(name: string, value: unknown): boolean {
  if (CAPITALISED_NAME.exec(name) === null) {
    return false;
  }

  if (typeof value === 'function') {
    return !Function.prototype.toString
      .call(value)
      .trimStart()
      .startsWith('class');
  }

  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { $$typeof?: symbol }).$$typeof === 'symbol'
  );
}

const exportedComponents = [
  ...Object.entries(UI),
  ...Object.entries({ Toaster }),
]
  .filter(([name, value]) => isExportedComponent(name, value))
  .map(([name]) => name);

const exercised = new Set(SURFACES.map(({ component }) => component));

describe('closed surfaces', () => {
  it.each(SURFACES.map((surface) => [surface.component, surface] as const))(
    'test_closed_surface_given_cast_and_spread_expect_injected_class_rejected',
    (_component, surface) => {
      render(surface.element);

      expect(surface.query()).not.toHaveClass('INJECTED');
    },
  );

  it.each(SURFACES.map((surface) => [surface.component, surface] as const))(
    'test_closed_surface_given_cast_and_spread_expect_inline_style_rejected',
    (_component, surface) => {
      render(surface.element);

      expect(surface.query()).not.toHaveStyle({ color: 'red' });
    },
  );

  it('test_closed_surface_given_exported_component_expect_guarded_or_declared_dom_free', () => {
    const unguarded = exportedComponents.filter(
      (name) =>
        !CLOSED_COMPONENTS.includes(name) && !RENDERLESS_EXPORTS.has(name),
    );

    expect(
      unguarded,
      'Every exported component is a closed surface the rule must guard, or belongs in RENDERLESS_EXPORTS with the reason it renders no DOM of its own.',
    ).toEqual([]);
  });

  it('test_closed_surface_given_declared_closed_component_expect_exercised_by_the_inventory', () => {
    const unexercised = exportedComponents.filter(
      (name) =>
        CLOSED_COMPONENTS.includes(name) &&
        !exercised.has(name) &&
        !HOST_RENDERED_EXPORTS.has(name),
    );

    expect(
      unexercised,
      'A component declared closed is exercised above, with the element whose injected surface must be rejected, unless it is a host wrapper that renders nothing inert.',
    ).toEqual([]);
  });
});

describe('Tabs', () => {
  it('test_tabs_given_selection_changes_expect_selected_text_and_inset_bar_without_geometry_change', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <TabsList aria-label="Views">
          <TabsTrigger value="one">First</TabsTrigger>
          <TabsTrigger value="two">Second</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const first = screen.getByRole('tab', { name: 'First' });
    const second = screen.getByRole('tab', { name: 'Second' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveClass(
      'data-[state=active]:text-selected',
      'data-[state=active]:shadow-[inset_0_-2px_0_var(--border-selected)]',
      'px-3',
      'py-1',
    );
    expect(first).not.toHaveClass('data-[state=active]:text-default');
    expect(screen.getByRole('tablist', { name: 'Views' })).toHaveClass(
      'h-9',
      'p-1',
    );

    await user.click(second);

    expect(first).toHaveAttribute('data-state', 'inactive');
    expect(second).toHaveAttribute('data-state', 'active');
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveClass(
      'data-[state=active]:text-selected',
      'data-[state=active]:shadow-[inset_0_-2px_0_var(--border-selected)]',
    );
  });
});
