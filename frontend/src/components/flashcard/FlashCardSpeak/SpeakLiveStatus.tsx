import { Button } from '@/components/common/Button/Button';

import { speakPhaseStatus } from './speakView';
import type { SpeakPhase } from './useSpeakSession';

/** Visually-hidden live region announcing phase + transcript changes. */
export function SpeakLiveStatus({
  phase,
  transcript,
}: {
  phase: SpeakPhase;
  transcript: string | null;
}) {
  return (
    <p aria-live="polite" className="sr-only" role="status">
      {speakPhaseStatus(phase)}
      {phase === 'reviewed' && transcript ? ` We heard: ${transcript}.` : ''}
    </p>
  );
}

export function SpeakEscapeAction({
  phase,
  visible,
  onSkip,
}: {
  phase: SpeakPhase;
  visible: boolean;
  onSkip: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <Button
      className="w-full text-muted-foreground sm:w-auto"
      onClick={onSkip}
      variant="ghost"
    >
      {phase === 'denied' ? 'Continue without speaking' : "Can't speak now"}
    </Button>
  );
}
