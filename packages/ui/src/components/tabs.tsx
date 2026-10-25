import * as TabsPrimitive from '@radix-ui/react-tabs';

import { createClosedRenderer, type ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { TEXT_SIZE, TEXT_WEIGHT } from './text-variants';

export type TabsProps = ClosedProps<typeof TabsPrimitive.Root>;

const renderTabs = createClosedRenderer(TabsPrimitive.Root);

const Tabs = (props: TabsProps) => renderTabs(props);
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = ({
  ref,
  ...props
}: ClosedProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    ref={ref}
    {...props}
    className={cn(
      'inline-flex h-9 items-center justify-center radius-field bg-neutral-subtle p-1 text-subtle',
    )}
    style={undefined}
  />
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = ({
  ref,
  ...props
}: ClosedProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    ref={ref}
    {...props}
    className={cn(
      `inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 ${TEXT_SIZE.sm} ${TEXT_WEIGHT.semibold} ring-offset-[var(--background-neutral)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:border disabled:border-disabled disabled:bg-disabled disabled:text-disabled data-[state=active]:bg-neutral data-[state=active]:text-selected data-[state=active]:shadow-[inset_0_-2px_0_var(--border-selected)]`,
    )}
    style={undefined}
  />
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = ({
  ref,
  ...props
}: ClosedProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    ref={ref}
    {...props}
    className={cn(
      'mt-2 ring-offset-[var(--background-neutral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-2',
    )}
    style={undefined}
  />
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
