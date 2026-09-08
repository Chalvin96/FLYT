import {
  compareTranscript,
  isTranscriptPassing,
  type DiffToken,
} from './transcriptDiff';
import type { SpeakPhase } from './useSpeakSession';

export const SPEAK_STATUS: Record<SpeakPhase, string> = {
  permission: 'Microphone needed',
  ready: 'Tap to speak',
  recording: 'Listening…',
  pending: 'Checking your recording…',
  reviewed: 'Try again, or check to move on',
  denied: 'Microphone unavailable',
  error: "We couldn't check that recording",
};

export interface SpeakReview {
  comparison: ReturnType<typeof compareTranscript> | null;
  missing: DiffToken[];
  didPass: boolean;
}

export function buildSpeakReview(
  target: string,
  transcript: string | null,
): SpeakReview {
  if (!transcript) {
    return { comparison: null, missing: [], didPass: false };
  }
  const comparison = compareTranscript(target, transcript);
  return {
    comparison,
    missing: comparison.target.filter((token) => !token.matched),
    didPass: isTranscriptPassing(target, transcript),
  };
}

export function speakPhaseStatus(phase: SpeakPhase): string {
  return SPEAK_STATUS[phase];
}
