import { Heading, IconWell, Text, type IconWellTone } from '@flyt/ui';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export interface PracticeCardProps {
  to: string;
  search?: { mode: 'quick' | 'full' };
  icon: LucideIcon;
  title: string;
  subtitle: string;
  iconTone: IconWellTone;
}

export function PracticeCard({
  to,
  search,
  icon: Icon,
  title,
  subtitle,
  iconTone,
}: PracticeCardProps) {
  return (
    <Link
      className="shadow-soft radius-field flex items-center gap-3 border border-default bg-raised p-4 transition-transform duration-200 hover:-translate-y-0.5"
      search={search as never}
      to={to as never}
    >
      <IconWell tone={iconTone} shape="circle" size="lg" icon={Icon} />
      <div className="min-w-0 flex-1">
        <Heading as="div" size="small" tone="default">
          {title}
        </Heading>
        <Text size="large" tone="subtle">
          {subtitle}
        </Text>
      </div>
      <ArrowRight className="icon-sm text-subtle" />
    </Link>
  );
}
