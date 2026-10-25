import { Text, textVariants } from '@flyt/ui';

import { GenderBadge } from './GenderBadge';
import { getGenderFromTags, getOtherTags } from './grammar';

export interface WordFormChipProps {
  form: string;
  tags: string[];
  variant?: 'default' | 'highlight';
}

const ROW_TONE = {
  default: 'border-default bg-neutral-subtle text-default',
  highlight: 'border-brand-subtle bg-selected text-selected',
};

export const WordFormChip = ({
  form,
  tags,
  variant = 'default',
}: WordFormChipProps) => {
  const gender = getGenderFromTags(tags);
  const otherTags = getOtherTags(tags);
  return (
    <span
      className={`flex w-full items-center justify-between gap-2 radius-sm border px-3 py-1.5 sm:gap-3 ${ROW_TONE[variant]}`}
      title={tags.join(', ')}
    >
      <span className="min-w-0 truncate">
        <Text as="span" weight="semibold">
          {form}
        </Text>
      </span>
      <span
        className={`flex max-w-[55%] shrink-0 items-center justify-end gap-1 text-right ${textVariants({ size: 'small', tone: 'subtle' })}`}
      >
        {gender && <GenderBadge gender={gender} />}
        {otherTags.length > 0 && (
          <span className="truncate">{otherTags.join(' \u2022 ')}</span>
        )}
      </span>
    </span>
  );
};
