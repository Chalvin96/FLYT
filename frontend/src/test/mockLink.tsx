import type { ReactNode } from 'react';

import { buildHref } from './mockLinkHref';

export interface MockLinkProps {
  children: ReactNode;
  className?: string;
  search?: Record<string, string>;
  to: string;
}

export function MockLink({ children, className, search, to }: MockLinkProps) {
  return (
    <a className={className} href={buildHref(to, search)}>
      {children}
    </a>
  );
}
