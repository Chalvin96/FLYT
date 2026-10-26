import type { ClosedProps } from '../lib/closed';

import { glyphVariants, type GlyphVariants } from './text-variants';

export type { GlyphSize } from './text-variants';

export type GlyphProps = ClosedProps<'span'> & GlyphVariants;

const TEXT_PRESENTATION = '\uFE0E';

const Glyph = ({ font, size, weight, children, ...props }: GlyphProps) => (
  <span
    aria-hidden="true"
    {...props}
    className={glyphVariants({ size, weight, font })}
    style={undefined}
  >
    {typeof children === 'string' ? children + TEXT_PRESENTATION : children}
  </span>
);
Glyph.displayName = 'Glyph';

export { Glyph };
