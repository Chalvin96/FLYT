import { STORY_GENERATION_ERROR_CODES } from '@/types/api';

export const STORY_GENERATION_PROCESSING_STALL_BACKSTOP_MS = 75_000;

export const STORY_GENERATION_TOPIC_MAX_CHARACTERS = 200;

export const ANCHOR_COPY: Record<
  string,
  { label: string; description: string }
> = {
  frequency: {
    label: 'Common words',
    description: 'The most frequent Norwegian words',
  },
  deck: {
    label: 'My deck',
    description: 'Words you are learning',
  },
  none: {
    label: 'Anything',
    description: 'No vocabulary limit',
  },
};

export const PROVIDER_COPY: Record<
  string,
  { label: string; description: string }
> = {
  openrouter: {
    label: 'Flyt',
    description: 'Built into Flyt.',
  },
  chatgpt: {
    label: 'ChatGPT',
    description: 'Uses your own account.',
  },
};

export const REQUEST_REFUSAL_CODES = new Set<string>([
  STORY_GENERATION_ERROR_CODES.TOPIC_TOO_LONG,
  STORY_GENERATION_ERROR_CODES.LENGTH_OUT_OF_RANGE,
  STORY_GENERATION_ERROR_CODES.PROVIDER_UNAVAILABLE,
  STORY_GENERATION_ERROR_CODES.ANCHOR_NOTHING_TO_TEACH,
  STORY_GENERATION_ERROR_CODES.ALLOWANCE_EXHAUSTED,
  STORY_GENERATION_ERROR_CODES.AGGREGATE_CEILING_REACHED,
]);
