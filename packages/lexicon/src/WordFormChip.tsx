import { Badge } from '@flyt/ui';
import { getGenderFromTags, getOtherTags } from './grammar';

import { GenderBadge } from './GenderBadge';

const VARIANT_STYLES = {
  default:
    'bg-secondary/30 text-secondary-foreground border border-secondary/40',
  highlight: 'bg-primary/15 text-primary border border-primary/30',
};

export interface WordFormChipProps {
  form: string;
  tags: string[];
  variant?: 'default' | 'highlight';
  className?: string;
}

export const WordFormChip = ({
  form,
  tags,
  variant = 'default',
  className = '',
}: WordFormChipProps) => {
  const gender = getGenderFromTags(tags);
  const otherTags = getOtherTags(tags);
  return (
    <Badge
      variant="outline"
      className={`${VARIANT_STYLES[variant]} ${className} w-full justify-between gap-2 radius-sm px-3 py-1.5 sm:gap-3`}
      title={tags.join(', ')}
    >
      <span className="min-w-0 truncate font-medium">{form}</span>
      <span className="max-w-[55%] shrink-0 text-right flex items-center justify-end gap-1 type-caption-sm text-muted-foreground">
        {gender && <GenderBadge gender={gender} size="sm" />}
        {otherTags.length > 0 && (
          <span className="truncate">{otherTags.join(' • ')}</span>
        )}
      </span>
    </Badge>
  );
};
