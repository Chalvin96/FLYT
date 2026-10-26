import { Heading, Text } from '@flyt/ui';
import type { ReactNode } from 'react';

export function StatCard({
  badge,
  borderClass,
  label,
  value,
}: {
  badge?: ReactNode;
  borderClass: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      className={`shadow-soft radius-field border-l-3 flex flex-col bg-raised p-3 ${borderClass}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Text size="2xl-none" tone="default" weight="bold">
          {value}
        </Text>
        {badge}
      </div>
      <p className="mt-2">
        <Heading as="span" size="xxsmall" tone="subtle">
          {label}
        </Heading>
      </p>
    </div>
  );
}
