import { posLabel } from './grammar';
import type { LemmaPos } from './types';
import { PronunciationRow } from './PronunciationRow';

export interface LemmaHeaderProps {
  word: string;
  pos: LemmaPos;
  ipa?: string | null;
  ipaApproximate?: boolean;
  intonation?: string | null;
  audioUrl?: string | null;
  headingAs?: 'h2' | 'h3';
  headingClassName?: string;
}

export function LemmaHeader({
  word,
  pos,
  ipa,
  ipaApproximate = false,
  intonation,
  audioUrl,
  headingAs: Tag = 'h3',
  headingClassName = 'font-display text-4xl leading-none text-secondary-90',
}: LemmaHeaderProps) {
  return (
    <header className="space-y-1.5">
      <div className="flex items-center gap-3">
        <Tag className={headingClassName}>{word}</Tag>
        <span className="radius-sm border border-secondary-30 bg-secondary-0 px-2 py-0.5 type-label-sm text-secondary-70">
          {posLabel(pos)}
        </span>
      </div>
      <PronunciationRow
        ipa={ipa}
        ipaApproximate={ipaApproximate}
        intonation={intonation}
        audioUrl={audioUrl}
      />
    </header>
  );
}
