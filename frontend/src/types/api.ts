import type {
  DefinitionRead,
  ExamplePair,
  LemmaPos,
  WordFormRead,
} from '@flyt/lexicon';

import type { components, paths } from './api.generated';
import type {
  AudioAsset,
  AudioStatus,
  Block,
  Exercise,
  InlineSpan,
  LessonKind,
  LessonPacket,
  SectionPacket,
} from './lesson-contracts';

type Schema<Name extends keyof components['schemas']> =
  components['schemas'][Name];

export type ApiComponents = components;
export type ApiPaths = paths;

export type CardState = Schema<'CardState'>;
export type { DefinitionRead, ExamplePair, LemmaPos, WordFormRead };

export const FlashCardType = {
  DEFINITION: 'definition',
  RECALL_FILL: 'recall_fill',
  CHOOSE: 'choose',
  CATEGORIZE: 'categorize',
  MATCH_PAIRS: 'match_pairs',
  BUILD: 'build',
  JUDGE: 'judge',
  FIND_FIX: 'find_fix',
  SPEAK: 'speak',
  WRITE: 'write',
} as const;
export type FlashCardType = Schema<'CardType'>;

export type LemmaRead = Omit<Schema<'LemmaRead'>, 'pos' | 'definitions'> & {
  pos: LemmaPos;
  definitions: DefinitionRead[];
};

export type LemmaContextRead = Schema<'LemmaContextRead'>;

export type DefinitionEntry = Omit<
  Schema<'DefinitionEntry'>,
  'examples_json'
> & { examples_json: ExamplePair[] };

export type DefinitionPayload = Omit<
  Schema<'DefinitionPayload'>,
  'pos' | 'definitions' | 'ipa_approximate'
> & {
  pos: LemmaPos;
  definitions: DefinitionEntry[];
  ipa_approximate?: boolean;
};

export interface FlashCardRenderable {
  id: number;
  user_id?: number;
  card: FlashCard;
  word_forms?: WordFormRead[];
  rating_previews?: RatingPreviews;
  context?: LemmaContextRead | null;
}

export type DefinitionFlashCard = Omit<
  Schema<'FlashCardDefinition'>,
  'type' | 'payload'
> & {
  type: typeof FlashCardType.DEFINITION;
  payload: DefinitionPayload;
};

export type OperationFlashCard = Omit<
  Schema<'FlashCardOperation'>,
  'payload' | 'audio'
> & {
  payload: Exercise;
  audio?: AudioAsset | null;
};

export type FlashCard = DefinitionFlashCard | OperationFlashCard;

export type UserCard = Omit<
  Schema<'UserCardRead'>,
  'card' | 'word_forms' | 'rating_previews'
> & {
  card: FlashCard;
  word_forms?: WordFormRead[];
  rating_previews?: RatingPreviews;
  context?: LemmaContextRead | null;
};

export interface RatingPreviews {
  again: string;
  hard: string;
  good: string;
  easy: string;
}

export type UngradedOutcome = 'skipped' | 'service_unavailable';

export type ReviewSubmission =
  | { card_id: number; outcome: 'graded'; rating: 1 | 2 | 3 | 4 }
  | { card_id: number; outcome: UngradedOutcome };

export type ReviewSubmissionBody = ReviewSubmission extends infer T
  ? T extends { card_id: number }
    ? Omit<T, 'card_id'>
    : never
  : never;

export type ReviewResult = Schema<'ReviewResult'>;

export type EmptyResponse = Schema<'EmptyResponse'>;

export interface ApiErrorDetail {
  code?: string | null;
  message?: string | null;
  error?: string | null;
}

export interface ApiErrorResponse {
  detail?: ApiErrorDetail | null;
}

export type LessonState = Schema<'LessonState'>;
export type UserRead = Schema<'UserRead'>;
export type UserUpdate = Schema<'UserUpdate'>;
export type DeletionPreviewRead = Schema<'DeletionPreviewRead'>;

export type LessonSummaryRead = Omit<Schema<'LessonSummaryRead'>, 'kind'> & {
  kind: LessonKind;
};

export type LessonProgressRead = Schema<'LessonProgressRead'>;
export type LessonAudioRead = Schema<'LessonAudioRead'>;
export type LessonMediaRead = Schema<'LessonMediaRead'>;

export type LessonDetailRead = Omit<
  Schema<'LessonDetailRead'>,
  'kind' | 'packet'
> & {
  kind: LessonKind;
  packet: LessonPacket;
};

export type { AudioAsset, AudioStatus };

export type DeckSummaryItem = Schema<'DeckSummaryItem'>;
export type DashboardStatsRead = Omit<Schema<'StatsRead'>, 'accuracy7d'> & {
  accuracy7d: number | null;
};

export type ReadingWordState = Schema<'UserLemmaState'>;
export type UserLemmaRead = Schema<'UserLemmaRead'>;
export type UserLemmasResponse = Schema<'UserLemmasResponse'>;

export type ReadingGroup = Schema<'ReadingGroupRead'>;
export type ReadingGroupsResponse = Schema<'ReadingGroupsResponse'>;

export type { Block, Exercise, SectionPacket, InlineSpan };

export type ReadingStorySummary = Schema<'StorySummaryRead'>;
export type ReadingStoryListResponse = Schema<'StoryListResponse'>;
export type ReadingHeroStory = Schema<'HeroStoryRead'>;
export type ReadingHeroResponse = Schema<'ReadingHeroResponse'>;
export type ReadingHomeSection = Schema<'ReadingSectionRead'>;
export type ReadingHomeResponse = Schema<'ReadingHomeResponse'>;
export type ReadingStoryToken = Schema<'StoryTokenRead'>;
export type ReadingStoryPage = Schema<'StoryPageRead'>;
export type ReadingStoryPageResponse = Schema<'StoryPageResponse'>;
export type ReadingProgressUpdate = Schema<'StoryProgressUpdate'>;
export type ReadingStoryRecommendationsResponse =
  Schema<'StoryRecommendationsResponse'>;

export type StoryGenerationStatus =
  'processing' | 'ready' | 'failed' | 'refused';

export type StoryGenerationProvider = Omit<
  Schema<'ProviderChoiceRead'>,
  'reason' | 'action'
> & {
  reason: string | null;
  action: string | null;
};
export type StoryGenerationAnchor = Omit<
  Schema<'AnchorChoiceRead'>,
  'reason'
> & { reason: string | null };
export type StoryGenerationSurfaceResponse = Omit<
  Schema<'GenerationSurfaceRead'>,
  'providers' | 'anchors'
> & {
  providers: StoryGenerationProvider[];
  anchors: StoryGenerationAnchor[];
};
export type StoryGenerationPageToken = Schema<'GenerationPageTokenRead'>;
export type StoryGenerationPage = Schema<'GenerationPageRead'>;

export type StoryGenerationCurrentResponse = Omit<
  Schema<'GenerationCurrentRead'>,
  'status' | 'pages' | 'failureCode' | 'failureMessage'
> & {
  status: StoryGenerationStatus;
  pages: StoryGenerationPage[] | null;
  failureCode: string | null;
  failureMessage: string | null;
};

export type StoryGenerationCreate = Omit<
  Schema<'GenerationCreate'>,
  'anchor' | 'length' | 'topic'
> & {
  anchor?: string;
  length?: number;
  topic?: string;
};

export type StoryGenerationCreateResponse = Omit<
  Schema<'GenerationCreateResponse'>,
  'status'
> & { status: 'processing' };

export const STORY_GENERATION_ERROR_CODES = {
  ALLOWANCE_EXHAUSTED: 'STORY_GENERATION_ALLOWANCE_EXHAUSTED',
  AGGREGATE_CEILING_REACHED: 'STORY_GENERATION_AGGREGATE_CEILING_REACHED',
  ANCHOR_NOTHING_TO_TEACH: 'STORY_GENERATION_ANCHOR_NOTHING_TO_TEACH',
  TOPIC_TOO_LONG: 'STORY_GENERATION_TOPIC_TOO_LONG',
  LENGTH_OUT_OF_RANGE: 'STORY_GENERATION_LENGTH_OUT_OF_RANGE',
  PROVIDER_UNAVAILABLE: 'STORY_GENERATION_PROVIDER_UNAVAILABLE',
  GENERATION_FAILED: 'STORY_GENERATION_FAILED',
} as const;

export type ReadingDefinition = Omit<
  Schema<'LemmaDefinitionRead'>,
  'examples' | 'translation_source'
> & {
  translation_source: string | null;
  examples: ExamplePair[];
};

export type ReadingLemma = Omit<
  Schema<'LemmaSummaryRead'>,
  'pos' | 'primary_translation' | 'see_also' | 'ipa_approximate'
> & {
  pos: LemmaPos;
  primary_translation: string | null;
  see_also?: SeeAlsoRead[];
  ipa_approximate?: boolean;
};

export type SeeAlsoRead = Schema<'SeeAlsoRead'>;
export type ReadingLemmaDefinitionsResponse = Omit<
  Schema<'LemmaDefinitionsResponse'>,
  'lemma' | 'definitions'
> & { lemma: ReadingLemma; definitions: ReadingDefinition[] };

export type BrowseSuggestion = Schema<'BrowseSuggestion'>;
export type BrowseSuggestionsResponse = Schema<'BrowseSuggestionsResponse'>;
export type BrowseEntry = Schema<'BrowseEntry'>;
export type BrowseHeadwordEntryResponse = Schema<'BrowseHeadwordEntryResponse'>;

export type MasteryBucket =
  'not_started' | 'learning' | 'familiar' | 'known' | 'mastered';
export type CardFacet = 'all' | 'vocab' | 'grammar';
export type CardSort = 'weakest' | 'recent' | 'alpha';

export type MyCardItem = Schema<'MyCardItem'>;
export type MyCardsSummary = Omit<
  Schema<'MyCardsSummary'>,
  'counts_by_bucket'
> & { counts_by_bucket: Record<MasteryBucket, number> };
export type MyCardsResponse = Omit<Schema<'MyCardsResponse'>, 'summary'> & {
  summary: MyCardsSummary;
};

export interface MyCardsParams {
  facet?: CardFacet;
  bucket?: MasteryBucket | null;
  started_only?: boolean;
  q?: string;
  sort?: CardSort;
  page?: number;
  limit?: number;
}

export type ImportStatus = Schema<'ImportStatus'>;
export type ImportItem = Schema<'ImportItemRead'>;
export type ImportQuota = Schema<'QuotaRead'>;
export type ImportListResponse = Schema<'ImportListResponse'>;
export type ImportStatusFilter = ImportStatus;
export type PasteImportCreate = Schema<'PasteImportCreate'>;

export const IMPORT_ERROR_CODES = {
  EMPTY: 'IMPORT_EMPTY',
  TOO_LARGE: 'IMPORT_TOO_LARGE',
  INVALID_SOURCE_URL: 'IMPORT_INVALID_SOURCE_URL',
  QUOTA_EXCEEDED: 'IMPORT_QUOTA_EXCEEDED',
  NOT_READY: 'IMPORT_NOT_READY',
  NOT_RETRYABLE: 'IMPORT_NOT_RETRYABLE',
  NOT_FOUND: 'IMPORT_NOT_FOUND',
} as const;

export const IMPORT_TEXT_MAX_BYTES = 100_000;
