export type Lang = 'en' | 'no';

export const LESSON_PACKET_SCHEMA_VERSION = '4.0' as const;

export type AudioStatus = 'synthesized';

export type AudioAsset = {
  id: string;
  url: string;
  path: string;
  mime: string;
  duration_ms?: number | null;
  sha256?: string | null;
  status: AudioStatus;
};

export type TextSpan = { kind: 'text'; value: string };
export type EmphasisSpan = { kind: 'emphasis'; value: string };
export type StrongSpan = { kind: 'strong'; value: string };
export type CodeSpan = { kind: 'code'; value: string };
export type ForeignTermSpan = {
  kind: 'foreign_term';
  value: string;
  lang: Lang;
};
export type InlineSpan =
  TextSpan | EmphasisSpan | StrongSpan | CodeSpan | ForeignTermSpan;
export type Spans = InlineSpan[];

export type HeadingBlock = {
  kind: 'heading';
  id: string;
  level: 3 | 4;
  spans: Spans;
};
export type ParagraphBlock = { kind: 'paragraph'; id: string; spans: Spans };
export type ReadingBlock = {
  kind: 'reading';
  id: string;
  spans: Spans;
  translation: string;
  speaker_id?: string | null;
  speaker_name?: string | null;
  dialogue_id?: string | null;
  turn_index?: number | null;
  speaker_icon_url?: string | null;
  audio_id?: string | null;
};
export type ListBlock = {
  kind: 'list';
  id: string;
  ordered: boolean;
  items: Spans[];
};
export type RuleBlock = { kind: 'rule'; id: string; statement: Spans };
export type ExampleBlock = {
  kind: 'example';
  id: string;
  no: Spans;
  en: Spans;
  audio_id?: string | null;
};
export type ExampleItem = Omit<ExampleBlock, 'kind'>;
export type ExamplesBlock = {
  kind: 'examples';
  id: string;
  items: ExampleItem[];
};
export type TableBlock = {
  kind: 'table';
  id: string;
  col_langs: Lang[];
  headers: Spans[];
  rows: Spans[][];
};
export type CalloutBlock = {
  kind: 'callout';
  id: string;
  level: 'tip' | 'warning' | 'note';
  blocks: Block[];
};
export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ReadingBlock
  | ListBlock
  | RuleBlock
  | ExampleBlock
  | ExamplesBlock
  | TableBlock
  | CalloutBlock;

export type SectionRole = 'orient' | 'model' | 'contrast' | 'recap';

export type SectionPacket = {
  kind: 'section';
  id: string;
  role: SectionRole;
  title: string;
  objective_ids: string[];
  blocks: Block[];
};

export type RecallFillPayload = {
  segments: Array<
    | { kind: 'span'; spans: Spans }
    | {
        kind: 'blank';
        blank_id: string;
        options: string[];
        answer_index: number;
      }
  >;
};
export type ChoosePayload = {
  stem?: Spans | null;
  options: Array<{ option_id: string; text: string; why?: string | null }>;
  answer_id: string;
};
export type CategorizePayload = {
  buckets: Array<{ bucket_id: string; label: string }>;
  items: Array<{ item_id: string; text: string; bucket_id: string }>;
};
export type MatchPairsPayload = {
  left: Array<{ left_id: string; text: string }>;
  right: Array<{ right_id: string; text: string }>;
  pairs: Array<{ left_id: string; right_id: string }>;
};
export type BuildPayload = {
  tokens: Array<{ token_id: string; text: string; fixed: boolean }>;
  answer_order: string[];
};
export type JudgePayload = {
  sentence: Spans;
  is_correct: boolean;
  feedback?: string | null;
};
export type FindFixPayload = {
  tokens: Array<{ token_id: string; text: string }>;
  error_token_id: string;
  feedback: string;
};
export type SpeakPayload = { target: string };
export type WriteCriterion = { id: string; instruction: string };
export type WritePayload = {
  response_language: 'no';
  min_words?: number | null;
  max_words?: number | null;
  /** Server-only model instruction; never expose it to learners. */
  judge_prompt?: string;
  criteria: WriteCriterion[];
};

export type Operation =
  | 'choose'
  | 'recall_fill'
  | 'match_pairs'
  | 'build'
  | 'judge'
  | 'find_fix'
  | 'categorize'
  | 'speak'
  | 'write';

interface ExerciseBase<T extends Operation, P> {
  kind: 'exercise';
  id: string;
  operation: T;
  objective_id: string;
  prompt: Spans;
  explanation: Spans | null;
  audio_id?: string | null;
  payload: P;
}

export type ChooseExercise = ExerciseBase<'choose', ChoosePayload>;
export type RecallFillExercise = ExerciseBase<'recall_fill', RecallFillPayload>;
export type MatchPairsExercise = ExerciseBase<'match_pairs', MatchPairsPayload>;
export type BuildExercise = ExerciseBase<'build', BuildPayload>;
export type JudgeExercise = ExerciseBase<'judge', JudgePayload>;
export type FindFixExercise = ExerciseBase<'find_fix', FindFixPayload>;
export type CategorizeExercise = ExerciseBase<'categorize', CategorizePayload>;
export type SpeakExercise = ExerciseBase<'speak', SpeakPayload>;
export type WriteExercise = ExerciseBase<'write', WritePayload>;

export type Exercise =
  | ChooseExercise
  | RecallFillExercise
  | MatchPairsExercise
  | BuildExercise
  | JudgeExercise
  | FindFixExercise
  | CategorizeExercise
  | SpeakExercise
  | WriteExercise;

export type CriterionVerdict = {
  criterion_id: string;
  met: boolean;
  evidence: string | null;
};

export type WriteJudgement = {
  criteria: CriterionVerdict[];
};

export type SpeechCheck = {
  transcript: string;
};

export type Objective = { id: string; statement: string };

export type ContentReference =
  { kind: 'section'; id: string } | { kind: 'exercise'; id: string };

export type PracticeGroup = {
  id: string;
  objective_id: string;
  exercise_ids: string[];
};

export type LessonKind =
  'grammar' | 'phraseology' | 'communicative' | 'pronunciation' | 'writing';

export type LessonPacket = {
  schema_version: typeof LESSON_PACKET_SCHEMA_VERSION;
  id: string;
  kind: LessonKind;
  language: 'nb-NO';
  title: string;
  cefr_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  goal: string;
  objectives: Objective[];
  /** Ordered traversal authority; `sections`/`exercises` are lookups. */
  content: ContentReference[];
  sections: SectionPacket[];
  exercises: Exercise[];
  practice_groups: PracticeGroup[];
  media: { audio: AudioAsset[] };
};
