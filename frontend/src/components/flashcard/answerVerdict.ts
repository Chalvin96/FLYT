export type AnswerVerdict =
  'idle' | 'selected' | 'correct' | 'incorrect' | 'revealed' | 'wrong-flash';

export type TileVerdict = Exclude<AnswerVerdict, 'wrong-flash'>;

export type ChoiceVerdict = Extract<
  AnswerVerdict,
  'idle' | 'selected' | 'correct' | 'incorrect'
>;

export type MatchTileVerdict = Extract<
  AnswerVerdict,
  'idle' | 'selected' | 'correct' | 'wrong-flash'
>;

export type BannerVerdict = Exclude<AnswerVerdict, 'idle' | 'selected'>;

export type GradedVerdict = Extract<AnswerVerdict, 'correct' | 'incorrect'>;

export type StatusVerdict = Extract<AnswerVerdict, 'idle' | GradedVerdict>;

export const answerVerdictStatusText: Record<
  AnswerVerdict,
  string | undefined
> = {
  idle: undefined,
  selected: 'selected',
  correct: 'correct',
  incorrect: 'incorrect',
  revealed: undefined,
  'wrong-flash': 'Incorrect — adjust your answer and try again.',
};

export const criterionStatusText: Record<StatusVerdict, string | undefined> = {
  idle: undefined,
  correct: 'met',
  incorrect: 'not met',
};

export const verdictTileClass: Record<TileVerdict, string> = {
  idle: 'border-strong bg-raised text-default shadow-[var(--control-shadow-resting)] hover:border-strong-hovered hover:bg-neutral-subtle',
  selected:
    'border-selected bg-selected text-selected shadow-[var(--control-shadow-resting)] hover:bg-selected-hovered',
  correct:
    'border-success bg-success-subtle text-success shadow-[var(--control-shadow-resting)]',
  incorrect:
    'border-danger bg-danger-subtle text-danger shadow-[var(--control-shadow-resting)]',
  revealed: 'border-hovered bg-neutral-subtle text-subtle shadow-none',
};

export const verdictTileMarkerClass: Record<TileVerdict, string> = {
  idle: 'bg-neutral-pressed text-default',
  selected: 'bg-brand-bold text-inverse',
  correct: 'bg-success text-success',
  incorrect: 'bg-danger-subtle-hovered text-danger',
  revealed: 'bg-neutral-pressed text-default',
};

export const verdictChipClass: Record<ChoiceVerdict, string> = {
  idle: 'radius-field border-default bg-raised text-default shadow-tile',
  selected: 'radius-field border-selected bg-selected text-default shadow-tile',
  correct:
    'radius-field border-success bg-success-subtle text-success shadow-tile',
  incorrect:
    'radius-field border-danger bg-danger-subtle text-danger shadow-tile',
};

export const verdictMatchTileClass: Record<MatchTileVerdict, string> = {
  idle: 'border-default bg-raised text-default hover:border-brand-subtle hover:bg-brand-subtle cursor-pointer',
  selected:
    'border-selected bg-brand-bold text-inverse scale-[1.03] shadow-lift',
  correct:
    'border-success-subtle bg-success-subtle text-success pointer-events-none',
  'wrong-flash': 'border-danger-subtle bg-danger-subtle text-danger',
};

export const verdictBlankClass: Record<ChoiceVerdict, string> = {
  idle: 'border-dashed border-hovered text-subtle',
  selected: 'border-selected text-selected',
  correct: 'border-success-subtle text-success',
  incorrect: 'border-danger-subtle text-danger',
};

export const verdictWordClass: Record<ChoiceVerdict, string> = {
  idle: 'bg-neutral-subtle text-default hover:bg-selected',
  selected: 'bg-selected text-selected',
  correct: 'bg-success-subtle text-success',
  incorrect: 'bg-danger-subtle text-danger line-through decoration-2',
};

export const verdictCriterionClass: Record<StatusVerdict, string> = {
  idle: 'border-default bg-raised/60',
  correct: 'border-success-subtle bg-success-subtle',
  incorrect: 'border-danger-subtle bg-danger-subtle',
};

export const verdictCriterionMarkerClass: Record<StatusVerdict, string> = {
  idle: 'border-default bg-raised text-subtle',
  correct: 'border-success-subtle bg-success-subtle text-success',
  incorrect: 'border-danger-subtle bg-danger-subtle text-danger',
};

export const verdictBannerClass: Record<BannerVerdict, string> = {
  correct: 'border-success-subtle bg-success-subtle text-success',
  incorrect: 'border-danger-subtle bg-danger-subtle text-danger',
  revealed: 'border-default bg-neutral-subtle text-default',
  'wrong-flash': 'border-danger-subtle bg-danger-subtle text-danger',
};

export const verdictFooterStatusClass: Record<StatusVerdict, string> = {
  idle: 'text-subtle',
  correct: 'text-success',
  incorrect: 'text-danger',
};

export const verdictDropTargetClass = 'border-selected bg-selected';
