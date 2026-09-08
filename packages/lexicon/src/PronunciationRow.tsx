'use client';

import {
  AudioPlayButton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@flyt/ui';

export interface PronunciationRowProps {
  ipa?: string | null;
  /** When true, IPA was auto-generated and may not be fully accurate */
  ipaApproximate?: boolean;
  intonation?: string | null;
  audioUrl?: string | null;
  size?: 'sm' | 'md';
}

const TONE_META = {
  '1': {
    label: 'T1',
    ariaLabel: 'Tone 1',
    tooltip:
      'Tone 1 — pitch falls on the stressed syllable. Common in monosyllabic words and singular noun forms.',
    // Square viewBox: plateau then fall
    path: 'M1,5 L11,5 L15,14',
    className: 'border-primary-20 bg-primary-10 text-primary-80',
  },
  '2': {
    label: 'T2',
    ariaLabel: 'Tone 2',
    tooltip:
      'Tone 2 — pitch rises then falls sharply. The characteristic sing-song melody of Norwegian.',
    // Square viewBox: rise then fall
    path: 'M1,14 L8,3 L15,14',
    className: 'border-accent-30 bg-accent-10 text-accent-80',
  },
} as const;

function ApproximateIndicator({ size }: { size: 'sm' | 'md' }) {
  const isSm = size === 'sm';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label="Approximate pronunciation"
          tabIndex={0}
          className={`relative inline-flex cursor-help items-center justify-center rounded-full border border-warning-60 bg-warning-10 text-warning-60 transition-colors after:absolute after:inset-[-6px] after:content-[''] hover:bg-warning-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${isSm ? 'h-3.5 w-3.5 text-[8px]' : 'h-4 w-4 text-[9px]'}`}
        >
          ≈
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[210px] text-center type-caption-sm leading-snug"
      >
        Pronunciation is auto-generated and may not be accurate for all forms.
        Verify in a dictionary for precision.
      </TooltipContent>
    </Tooltip>
  );
}

function PitchBadge({
  intonation,
  size,
}: {
  intonation: '1' | '2';
  size: 'sm' | 'md';
}) {
  const meta = TONE_META[intonation];
  const isSm = size === 'sm';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={meta.ariaLabel}
          tabIndex={0}
          className={`inline-flex shrink-0 cursor-default items-center gap-1 rounded border px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${isSm ? 'py-0' : 'py-0.5'} ${meta.className}`}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isSm ? 'icon-xs' : 'icon-sm'}
            aria-hidden="true"
          >
            <path d={meta.path} />
          </svg>
          <span
            className={`font-mono font-semibold leading-none ${isSm ? 'text-[9px]' : 'text-[10px]'}`}
          >
            {meta.label}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[220px] text-center type-caption-sm leading-snug"
      >
        {meta.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function PronunciationRow({
  ipa,
  ipaApproximate = false,
  intonation,
  audioUrl,
  size = 'md',
}: PronunciationRowProps) {
  if (!ipa && !intonation && !audioUrl) return null;

  const tone = intonation === '1' || intonation === '2' ? intonation : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2">
        {ipa && (
          <span className="flex items-center gap-1">
            <span
              className={`font-mono text-muted-foreground ${size === 'sm' ? 'type-caption-sm' : 'type-caption'}`}
            >
              /{ipa}/
            </span>
            {ipaApproximate && <ApproximateIndicator size={size} />}
          </span>
        )}
        {tone && <PitchBadge intonation={tone} size={size} />}
        {audioUrl && (
          <AudioPlayButton
            src={audioUrl}
            tone="compact"
            size={size}
            label="Play pronunciation"
            playingLabel="Playing pronunciation"
          />
        )}
      </div>
    </TooltipProvider>
  );
}
