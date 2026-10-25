import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

import type { ClosedProps } from '../lib/closed';

type SonnerProps = React.ComponentProps<typeof Sonner>;

// `toastOptions` carries a `classNames` map, so it is as much a styling surface
// as `className` is.
export type ToasterProps = Omit<ClosedProps<typeof Sonner>, 'toastOptions'>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      {...props}
      theme={theme as SonnerProps['theme']}
      className="toaster group"
      style={undefined}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-neutral group-[.toaster]:text-default group-[.toaster]:border-default group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-subtle',
          actionButton:
            'group-[.toast]:bg-brand-bold group-[.toast]:text-inverse',
          cancelButton:
            'group-[.toast]:bg-neutral-subtle group-[.toast]:text-subtle',
        },
      }}
    />
  );
};

export { Toaster };
