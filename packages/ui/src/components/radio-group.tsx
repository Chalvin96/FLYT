import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { createClosedRenderer, type ClosedProps } from '../lib/closed';

export type RadioGroupProps = ClosedProps<typeof RadioGroupPrimitive.Root>;
export type RadioGroupItemProps = ClosedProps<typeof RadioGroupPrimitive.Item>;

const renderRadioGroup = createClosedRenderer(RadioGroupPrimitive.Root);
const renderRadioGroupItem = createClosedRenderer(RadioGroupPrimitive.Item);

const RadioGroup = (props: RadioGroupProps) => renderRadioGroup(props);
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = (props: RadioGroupItemProps) =>
  renderRadioGroupItem(props);
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
