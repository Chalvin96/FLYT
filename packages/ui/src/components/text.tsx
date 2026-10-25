import * as React from 'react';

import type { ClosedProps } from '../lib/closed';
import { textVariants, type TextVariants } from './text-variants';

export type {
  BodySize,
  TextFont,
  TextRole,
  TextSize,
  TextTone,
  TextWeight,
} from './text-variants';

export type TextTag =
  | 'p'
  | 'div'
  | 'span'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'label'
  | 'legend'
  | 'dt'
  | 'dd'
  | 'li'
  | 'figcaption'
  | 'blockquote'
  | 'caption'
  | 'th'
  | 'td'
  | 'summary'
  | 'b'
  | 'strong'
  | 'em'
  | 'i'
  | 'u'
  | 's'
  | 'small'
  | 'sub'
  | 'sup'
  | 'mark'
  | 'time'
  | 'cite'
  | 'code';

export type TextProps<T extends TextTag = 'p'> = Omit<ClosedProps<T>, 'role'> &
  TextVariants & {
    as?: T;
  };

const Text = <T extends TextTag = 'p'>({
  as,
  containerSize,
  font,
  role,
  size,
  smSize,
  tone,
  weight,
  ...props
}: TextProps<T>) => {
  const Element = (as ?? 'p') as React.ElementType;

  return (
    <Element
      {...props}
      className={textVariants({
        containerSize,
        font,
        role,
        size,
        smSize,
        tone,
        weight,
      })}
      style={undefined}
    />
  );
};
Text.displayName = 'Text';

export { Text };
