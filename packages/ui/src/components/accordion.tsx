import * as AccordionPrimitive from '@radix-ui/react-accordion';

import { createClosedRenderer, type ClosedProps } from '../lib/closed';

export type AccordionProps = ClosedProps<typeof AccordionPrimitive.Root>;
export type AccordionItemProps = ClosedProps<typeof AccordionPrimitive.Item>;
export type AccordionTriggerProps = ClosedProps<
  typeof AccordionPrimitive.Trigger
>;
export type AccordionContentProps = ClosedProps<
  typeof AccordionPrimitive.Content
>;

const renderAccordion = createClosedRenderer(AccordionPrimitive.Root);
const renderAccordionItem = createClosedRenderer(AccordionPrimitive.Item);
const renderAccordionTrigger = createClosedRenderer(AccordionPrimitive.Trigger);
const renderAccordionContent = createClosedRenderer(AccordionPrimitive.Content);

const Accordion = (props: AccordionProps) => renderAccordion(props);
Accordion.displayName = AccordionPrimitive.Root.displayName;

const AccordionItem = (props: AccordionItemProps) => renderAccordionItem(props);
AccordionItem.displayName = AccordionPrimitive.Item.displayName;

const AccordionTrigger = (props: AccordionTriggerProps) =>
  renderAccordionTrigger(props);
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = (props: AccordionContentProps) =>
  renderAccordionContent(props);
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
