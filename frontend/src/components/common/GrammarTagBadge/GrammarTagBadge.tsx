import { Badge } from '@/components/ui/badge';

interface GrammarTagBadgeProps {
  label: string;
}

export function GrammarTagBadge({ label }: GrammarTagBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="border-secondary-20 bg-secondary-10 px-2 py-0.5 type-caption-sm text-secondary-80"
    >
      {label}
    </Badge>
  );
}
