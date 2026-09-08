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
      className={`shadow-soft radius-field border-l-3 flex flex-col bg-card p-3 ${borderClass}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="type-stat text-foreground">{value}</p>
        {badge}
      </div>
      <p className="type-label mt-2 text-muted-foreground">{label}</p>
    </div>
  );
}
