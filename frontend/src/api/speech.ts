import type { SpeechCheck } from '@/types/lesson-contracts';

import { client } from './client';

type SpeechTranscriptionResponse = {
  text: string;
  language: string;
  language_probability: number;
  duration_seconds: number;
  segments: Array<{ start: number; end: number; text: string }>;
};

function recordingFilename(audio: Blob): string {
  if (audio.type.includes('mp4')) return 'recording.m4a';
  if (audio.type.includes('ogg')) return 'recording.ogg';
  return 'recording.webm';
}

export async function transcribeSpeech(audio: Blob): Promise<SpeechCheck> {
  const form = new FormData();
  form.append('file', audio, recordingFilename(audio));
  const response = await client.post<SpeechTranscriptionResponse>(
    '/speech/transcribe',
    form,
  );
  return { transcript: response.data.text };
}
