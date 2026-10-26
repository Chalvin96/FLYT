import * as SeparatorPrimitive from '@radix-ui/react-separator';

import type { ClosedProps } from '../lib/closed';

const Separator = ({
  decorative = true,
  ref,
  ...props
}: Omit<ClosedProps<typeof SeparatorPrimitive.Root>, 'orientation'>) => (
  <SeparatorPrimitive.Root
    ref={ref}
    {...props}
    decorative={decorative}
    orientation="horizontal"
    className="h-[1px] w-full shrink-0 bg-[var(--border-default)]"
    style={undefined}
  />
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
