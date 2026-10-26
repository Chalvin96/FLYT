import * as React from 'react';

type ClosedOwnProps<Props> = Props extends unknown
  ? Omit<Props, 'className' | 'style'>
  : never;

export type ClosedProps<T extends React.ElementType> = ClosedOwnProps<
  React.ComponentPropsWithRef<T>
>;

export function createClosedRenderer<T extends React.ElementType>(
  Primitive: T,
) {
  const rendered = Primitive as React.ComponentType<Record<string, unknown>>;
  return (props: ClosedProps<T>) =>
    React.createElement(rendered, {
      ...props,
      className: undefined,
      style: undefined,
    });
}
