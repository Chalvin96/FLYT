import { Badge, type BadgeTone } from '@flyt/ui';
import { getArticleForGender } from './grammar';

const TONE_BY_GENDER: Record<string, BadgeTone> = {
  Masc: 'neutral',
  Fem: 'brand',
  Neuter: 'success',
  'Masc/Fem': 'neutral',
};

export function GenderBadge({ gender }: { gender: string }) {
  const article = getArticleForGender(gender);

  return (
    <Badge
      shape="pill"
      size="sm"
      tone={TONE_BY_GENDER[gender] ?? TONE_BY_GENDER.Masc}
    >
      {article}
    </Badge>
  );
}
