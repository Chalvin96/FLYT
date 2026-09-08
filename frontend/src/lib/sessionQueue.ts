import type { CardState, UserCard } from '@/types/api';

/**
 * Learn-ahead window. A learning/relearning card whose due falls within this
 * many milliseconds of `now` is surfaced even when nothing is strictly due.
 */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

/**
 * An immutable, id-keyed bag of the cards currently in a review session.
 * Keys are `UserCard.id`. Mutators return a new `SessionQueue` rather than
 * mutating in place.
 */
export interface SessionQueue {
  readonly cards: ReadonlyMap<number, UserCard>;
}

export type ShowNextResult =
  { kind: 'card'; card: UserCard; ahead: boolean } | { kind: 'done' };

export type QueueCounts = { new: number; learning: number; review: number };

/** UTC midnight that immediately follows `ms` (start of the next UTC day). */
export function startOfNextUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Build a session queue keyed by `UserCard.id`. Later duplicates win. */
export function buildQueue(cards: UserCard[]): SessionQueue {
  const map = new Map<number, UserCard>();
  for (const c of cards) map.set(c.id, c);
  return { cards: map };
}

/**
 * Pick the next card to show.
 *
 * Among cards due now (`due_at <= nowMs`), prefer learning/relearning, then
 * review, then new; break ties by smallest due then id. If nothing is due
 * now, surface the soonest learning/relearning card whose due is within
 * `LEARN_AHEAD_MS` (learn-ahead). Otherwise the queue is `done` for the
 * moment: the model is completion-only — there is no waiting state, no
 * countdown, and no auto-advance timer. A `done` result with learning cards
 * still in the queue means "more due later today".
 *
 * The `card` variant carries `ahead`: `false` when the card is strictly due
 * now, `true` when it was surfaced via the learn-ahead branch (i.e. its raw
 * due is still in the future).
 *
 * Anki interleave (rslib `requeue_learning_entry`): when the top of the
 * showable list is the card the user just answered (`lastShownUserCardId`)
 * and at least one OTHER card is showable, show the other card instead —
 * "interleave one card, unless it's the only card left". When the
 * just-answered card is the sole showable card, it repeats.
 */
export function showNext(
  q: SessionQueue,
  nowMs: number,
  lastShownUserCardId?: number,
): ShowNextResult {
  const all = [...q.cards.values()];
  if (all.length === 0) return { kind: 'done' };

  const dueNow = all
    .filter((c) => Date.parse(c.due_at) <= nowMs)
    .sort(compareByPriorityThenDue);

  const aheadCutoff = nowMs + LEARN_AHEAD_MS;
  const ahead = all
    .filter(
      (c) =>
        (c.state === 'learning' || c.state === 'relearning') &&
        Date.parse(c.due_at) > nowMs &&
        Date.parse(c.due_at) <= aheadCutoff,
    )
    .sort(compareByDueThenId);

  // Show priority: strictly-due cards first (by priority then due), then
  // learn-ahead learning cards (by due). dueNow and ahead are disjoint
  // (due<=now vs now<due).
  const showable = [...dueNow, ...ahead];
  if (showable.length === 0) return { kind: 'done' };

  // Anki requeue_learning_entry: do not re-show the just-answered card
  // immediately when another showable card exists ("interleave one card,
  // unless it's the only card left").
  let pick = showable[0];
  if (pick.id === lastShownUserCardId && showable.length > 1) {
    pick = showable[1];
  }

  return { kind: 'card', card: pick, ahead: Date.parse(pick.due_at) > nowMs };
}

/**
 * Apply a review result by `userCardId` (replace-by-id). The card is kept in
 * the session iff it stays in a learning/relearning step and is still due
 * within the same UTC day as `nowMs`; otherwise it is dropped (graduated to
 * review or scheduled to a future day). Returns a new queue; the input queue
 * is unchanged. A no-op (returns the same reference) when the id is absent.
 */
export function applyReview(
  q: SessionQueue,
  userCardId: number,
  newState: CardState,
  newDueAtMs: number,
  nowMs: number,
): SessionQueue {
  const existing = q.cards.get(userCardId);
  if (existing === undefined) return q;

  const keep =
    (newState === 'learning' || newState === 'relearning') &&
    newDueAtMs < startOfNextUtcDay(nowMs);

  const next = new Map(q.cards);
  if (keep) {
    next.set(userCardId, {
      ...existing,
      state: newState,
      due_at: new Date(newDueAtMs).toISOString(),
    });
  } else {
    next.delete(userCardId);
  }
  return { cards: next };
}

/**
 * Count remaining cards by coarse bucket. `learning` folds learning +
 * relearning.
 */
export function counts(q: SessionQueue): QueueCounts {
  let n = 0;
  let l = 0;
  let r = 0;
  for (const c of q.cards.values()) {
    if (c.state === 'new') n++;
    else if (c.state === 'review') r++;
    else l++;
  }
  return { new: n, learning: l, review: r };
}

// --- internals ---

function statePriority(state: CardState): number {
  switch (state) {
    case 'learning':
    case 'relearning':
      return 0;
    case 'review':
      return 1;
    case 'new':
      return 2;
  }
}

function compareByPriorityThenDue(a: UserCard, b: UserCard): number {
  const pa = statePriority(a.state);
  const pb = statePriority(b.state);
  if (pa !== pb) return pa - pb;
  return compareByDueThenId(a, b);
}

function compareByDueThenId(a: UserCard, b: UserCard): number {
  const da = Date.parse(a.due_at);
  const db = Date.parse(b.due_at);
  if (da !== db) return da - db;
  return a.id - b.id;
}
