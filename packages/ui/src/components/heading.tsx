import type { ClosedProps } from '../lib/closed';

import {
  headingVariants,
  type HeadingSize,
  type TextTone,
  type TextWeight,
} from './text-variants';

export type { HeadingSize } from './text-variants';

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'span';

export type HeadingProps = ClosedProps<'h2'> & {
  as?: HeadingTag;
  size: HeadingSize;
  tone?: TextTone;
  weight?: TextWeight;
};

const Heading = ({
  as: Element = 'h2',
  size,
  tone,
  weight,
  ...props
}: HeadingProps) => (
  <Element
    {...props}
    className={headingVariants({ size, tone, weight })}
    style={undefined}
  />
);
Heading.displayName = 'Heading';

export { Heading };
