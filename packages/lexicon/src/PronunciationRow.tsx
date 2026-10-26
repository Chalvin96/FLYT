'use client';

import {
  AudioPlayButton,
  Glyph,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  textVariants,
} from '@flyt/ui';
import { cn } from '@flyt/ui/lib/utils';
import type { GlyphSize, TextSize } from '@flyt/ui';

export type PronunciationPresentation = 'default' | 'flashcard';

export interface PronunciationRowProps {
  ipa?: string | null;
  /** When true, IPA was auto-generated and may not be fully accurate */
  ipaApproximate?: boolean;
  intonation?: string | null;
  audioUrl?: string | null;
  size?: 'sm' | 'md';
  /** `flashcard` puts the quiet audio control after the metadata, inset into the band. */
  presentation?: PronunciationPresentation;
}

const TONE_META = {
  '1': {
    label: 'T1',
    ariaLabel: 'Tone 1',
    tooltip:
      'Tone 1 — pitch falls on the stressed syllable. Common in monosyllabic words and singular noun forms.',
    path: 'M1,5 L11,5 L15,14',
    className: 'border-brand-subtle bg-brand-subtle text-selected',
  },
  '2': {
    label: 'T2',
    ariaLabel: 'Tone 2',
    tooltip:
      'Tone 2 — pitch rises then falls sharply. The characteristic sing-song melody of Norwegian.',
    path: 'M1,14 L8,3 L15,14',
    className: 'border-success-subtle bg-success-subtle text-success',
  },
} as const;

type Tone = keyof typeof TONE_META;

const APPROXIMATE_INDICATOR_LAYOUT: Record<'sm' | 'md', string> = {
  sm: '-top-1 h-3 w-1.5',
  md: '-top-1.5 h-3.5 w-2',
};

const APPROXIMATE_INDICATOR_SIZE: Record<'sm' | 'md', GlyphSize> = {
  sm: '4xs',
  md: '2xs',
};

const PITCH_BADGE_PADDING: Record<'sm' | 'md', string> = {
  sm: 'py-0',
  md: 'py-0.5',
};

const PITCH_ICON_SIZE: Record<'sm' | 'md', string> = {
  sm: 'icon-xs',
  md: 'icon-sm',
};

const PITCH_LABEL_SIZE: Record<'sm' | 'md', GlyphSize> = {
  sm: '4xs',
  md: '3xs',
};

const PRONUNCIATION_IPA_SIZE: Record<'sm' | 'md', TextSize> = {
  sm: 'xs',
  md: 'sm',
};

function ApproximateIndicator({ size }: { size: 'sm' | 'md' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label="Pronunciation generated automatically."
          tabIndex={0}
          data-testid="ipa-approximate-marker"
          className={`relative inline-flex cursor-help items-start justify-center text-subtle after:absolute after:inset-[-8px] after:content-[''] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-1 ${APPROXIMATE_INDICATOR_LAYOUT[size]}`}
        >
          <Glyph size={APPROXIMATE_INDICATOR_SIZE[size]}>*</Glyph>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" width="narrow">
        Pronunciation generated automatically.
      </TooltipContent>
    </Tooltip>
  );
}

function PitchBadge({
  intonation,
  size,
}: {
  intonation: Tone;
  size: 'sm' | 'md';
}) {
  const meta = TONE_META[intonation];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={meta.ariaLabel}
          tabIndex={0}
          className={`inline-flex shrink-0 cursor-default items-center gap-1 rounded-[0.25rem] border px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] focus-visible:ring-offset-1 ${PITCH_BADGE_PADDING[size]} ${meta.className}`}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={PITCH_ICON_SIZE[size]}
            aria-hidden="true"
          >
            <path d={meta.path} />
          </svg>
          <Glyph font="mono" size={PITCH_LABEL_SIZE[size]} weight="semibold">
            {meta.label}
          </Glyph>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" width="narrow">
        {meta.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function PronunciationAudio({
  presentation,
  size,
  src,
}: {
  presentation: PronunciationPresentation;
  size: 'sm' | 'md';
  src: string;
}) {
  const isFlashcard = presentation === 'flashcard';
  const button = (
    <AudioPlayButton
      presentation={isFlashcard ? 'compact-quiet' : 'compact'}
      label="Play pronunciation"
      playingLabel="Playing pronunciation"
      size={size}
      src={src}
    />
  );

  if (!isFlashcard) return button;
  return <span className="-m-2 inline-flex">{button}</span>;
}

function PronunciationIpa({ ipa, size }: { ipa: string; size: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'min-w-0 max-w-full break-words',
        textVariants({
          size: PRONUNCIATION_IPA_SIZE[size],
          font: 'mono',
          tone: 'subtle',
        }),
      )}
    >
      /{ipa}/
    </span>
  );
}

export function PronunciationRow({
  ipa,
  ipaApproximate = false,
  intonation,
  audioUrl,
  size = 'md',
  presentation = 'default',
}: PronunciationRowProps) {
  if (!ipa && !intonation && !audioUrl) return null;

  const isFlashcard = presentation === 'flashcard';
  const tone = intonation === '1' || intonation === '2' ? intonation : null;
  const audio = audioUrl ? (
    <PronunciationAudio
      presentation={presentation}
      size={size}
      src={audioUrl}
    />
  ) : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {isFlashcard ? null : audio}
        {ipa ? <PronunciationIpa ipa={ipa} size={size} /> : null}
        {ipa && ipaApproximate ? <ApproximateIndicator size={size} /> : null}
        {tone ? <PitchBadge intonation={tone} size={size} /> : null}
        {isFlashcard ? audio : null}
      </div>
    </TooltipProvider>
  );
}
