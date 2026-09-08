import * as React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const appCardClassName =
  'radius-section shadow-raised border border-border bg-card text-card-foreground';

export const AppCard = ({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Card>) => (
  <Card ref={ref} className={cn(appCardClassName, className)} {...props} />
);

AppCard.displayName = 'AppCard';
