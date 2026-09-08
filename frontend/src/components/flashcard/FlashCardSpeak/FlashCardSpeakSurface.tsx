import { Mic } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';
import { AudioPlayButton } from '@/components/portable/AudioPlayButton';
import { cn } from '@/lib/utils';
import type { AudioAsset } from '@/types/lesson-contracts';

import type { DiffToken } from './transcriptDiff';

export function TargetSentence({ target }: { target: string }) {
  return (
    <p
      className="font-display type-title sm:type-display leading-prompt font-semibold text-balance"
      lang="no"
    >
      {target}
    </p>
  );
}

export function SpokenTranscript({ tokens }: { tokens: DiffToken[] }) {
  return (
    <p className="type-body text-foreground" lang="no">
      {tokens.map((token, index) => (
        <span
          className={cn(
            !token.matched &&
              'rounded-sm bg-destructive-0 px-0.5 font-semibold text-destructive-80 underline decoration-wavy underline-offset-4',
          )}
          key={index}
        >
          {token.text}
          {index < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}

const MODEL_WAVE = [
  38, 62, 45, 88, 70, 100, 82, 55, 96, 68, 40, 74, 52, 86, 60, 34,
];

function ModelWaveform() {
  return (
    <span aria-hidden="true" className="flex h-6 items-center gap-[3px]">
      {MODEL_WAVE.map((height, index) => (
        <span
          className="bg-secondary-30 w-[3px] rounded-full"
          key={index}
          style={{ height: `${height}%` }}
        />
      ))}
    </span>
  );
}

function LevelMeter({ animate }: { animate: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 items-end justify-center gap-[2px]"
    >
      {[0, 1, 2, 3].map((bar) => (
        <span
          className={cn(
            'w-[2px] rounded-full bg-current',
            animate && 'animate-pulse',
          )}
          key={bar}
          style={{
            height: animate ? `${40 + ((bar * 37) % 55)}%` : '55%',
            animationDelay: `${bar * 110}ms`,
          }}
        />
      ))}
    </span>
  );
}

export function SpeakModelAudio({ audio }: { audio?: AudioAsset | null }) {
  return (
    <div className="radius-field border-border bg-card flex items-center gap-3 border py-1.5 pr-4 pl-2">
      <AudioPlayButton asset={audio} label="Play the model" />
      <ModelWaveform />
    </div>
  );
}

export function SpeakRecordButton({
  isRecording,
  reducedMotion,
  onClick,
}: {
  isRecording: boolean;
  reducedMotion: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className={cn(
        'h-13 w-full sm:w-auto sm:min-w-56',
        isRecording
          ? 'border border-border bg-card text-foreground hover:border-destructive-20 hover:bg-destructive-0 hover:text-destructive-80'
          : 'bg-primary-70 hover:bg-primary-80',
      )}
      onClick={onClick}
      size="lg"
    >
      {isRecording ? (
        <LevelMeter animate={!reducedMotion} />
      ) : (
        <Mic aria-hidden="true" className="size-4" />
      )}
      {isRecording ? 'Stop recording' : 'Tap to speak'}
    </Button>
  );
}

export function SpeakReviewPanel({
  comparison,
  missing,
  onRecordAgain,
}: {
  comparison: { spoken: DiffToken[] };
  missing: DiffToken[];
  onRecordAgain: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="radius-field bg-secondary-5 w-full px-4 py-3">
        <p className="type-label text-muted-foreground mb-1">We heard</p>
        <SpokenTranscript tokens={comparison.spoken} />
        {missing.length ? (
          <div className="mt-3" data-testid="missing-transcript">
            <p className="type-label text-muted-foreground mb-1">Missing</p>
            <SpokenTranscript tokens={missing} />
          </div>
        ) : null}
      </div>
      <Button
        className="w-full sm:w-auto sm:min-w-56"
        onClick={onRecordAgain}
        variant="outline"
      >
        <Mic aria-hidden="true" className="size-4" />
        Record again
      </Button>
    </div>
  );
}

export function SpeakBlockedNotice({
  isDenied,
  onRetry,
}: {
  isDenied: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="radius-field flex w-full flex-col items-center gap-3 border border-warning-30 bg-warning-10 p-4">
      <p className="type-caption text-foreground">
        {isDenied
          ? 'Flyt cannot reach your microphone. Check your browser’s site permissions to enable it.'
          : 'We could not check that recording. Your connection may have dropped.'}
      </p>
      <Button className="w-full sm:w-auto" onClick={onRetry} variant="outline">
        {isDenied ? 'I have enabled it' : 'Try again'}
      </Button>
    </div>
  );
}
