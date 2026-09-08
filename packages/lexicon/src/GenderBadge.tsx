import { Badge } from '@flyt/ui';
import { getArticleForGender } from './grammar';

// Token colors per gender: Neuter → accent, Fem → warning, Masc → secondary,
// Masc/Fem → secondary (shows the "en/ei" article).
const COLOR_BY_GENDER: Record<string, string> = {
  Masc: 'bg-secondary-10 text-secondary-80 border border-secondary-30',
  Fem: 'bg-warning-10 text-warning-70 border border-warning-30',
  Neuter: 'bg-accent-10 text-accent-80 border border-accent-30',
  'Masc/Fem': 'bg-secondary-10 text-secondary-80 border border-secondary-30',
};

const SIZE_CLASS = {
  sm: 'px-2.5 py-0.5 type-caption-sm',
  md: 'px-3 py-1 type-caption',
  lg: 'px-3.5 py-1.5 type-body',
};

export function GenderBadge({
  gender,
  size = 'md',
}: {
  gender: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  // Design rule: gender badge shows the Norwegian article (en / et / en/ei).
  const article = getArticleForGender(gender);

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center rounded-full font-semibold ${COLOR_BY_GENDER[gender] ?? COLOR_BY_GENDER.Masc} ${SIZE_CLASS[size]}`}
    >
      {article}
    </Badge>
  );
}
