import { describe, expect, it } from 'vitest';

import type { CardState, UserCard } from '@/types/api';

import {
  applyReview,
  buildQueue,
  counts,
  LEARN_AHEAD_MS,
  showNext,
  startOfNextUtcDay,
} from './sessionQueue';

// Fixed "now" so day-boundary math is deterministic: 2026-06-26T12:00:00Z.
const NOW = Date.UTC(2026, 5, 26, 12, 0, 0);

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Minimal UserCard fixture: only id, state, due_at, card.id matter. */
function makeCard(id: number, state: CardState, dueMs: number): UserCard {
  return {
    id,
    state,
    due_at: iso(dueMs),
    card: { id: id * 10 },
  } as UserCard;
}

describe('startOfNextUtcDay', () => {
  it('returns the following UTC midnight', () => {
    expect(startOfNextUtcDay(Date.UTC(2026, 5, 26, 12, 0, 0))).toBe(
      Date.UTC(2026, 5, 27, 0, 0, 0),
    );
  });

  it('rolls into the next month at the day boundary', () => {
    expect(startOfNextUtcDay(Date.UTC(2026, 5, 30, 23, 59, 0))).toBe(
      Date.UTC(2026, 6, 1, 0, 0, 0),
    );
  });
});

describe('buildQueue', () => {
  it('keys cards by UserCard.id', () => {
    const a = makeCard(1, 'new', NOW);
    const b = makeCard(2, 'new', NOW);
    const q = buildQueue([a, b]);
    expect(q.cards.size).toBe(2);
    expect(q.cards.get(1)).toBe(a);
    expect(q.cards.get(2)).toBe(b);
  });

  it('last write wins on duplicate ids', () => {
    const a = makeCard(1, 'new', NOW);
    const b = makeCard(1, 'review', NOW);
    const q = buildQueue([a, b]);
    expect(q.cards.size).toBe(1);
    expect(q.cards.get(1)).toBe(b);
  });
});

describe('counts', () => {
  it('folds learning + relearning into the learning bucket', () => {
    const q = buildQueue([
      makeCard(1, 'new', NOW),
      makeCard(2, 'learning', NOW),
      makeCard(3, 'relearning', NOW),
      makeCard(4, 'review', NOW),
    ]);
    expect(counts(q)).toEqual({ new: 1, learning: 2, review: 1 });
  });

  it('returns zeros for an empty queue', () => {
    expect(counts(buildQueue([]))).toEqual({ new: 0, learning: 0, review: 0 });
  });
});

describe('applyReview (replace-by-id)', () => {
  it('keeps a card moved to learning with a due still within today', () => {
    const q = buildQueue([makeCard(1, 'new', NOW)]);
    const next = applyReview(q, 1, 'learning', NOW + 60_000, NOW);

    expect(next.cards.size).toBe(1);
    const updated = next.cards.get(1)!;
    expect(updated.state).toBe('learning');
    expect(updated.due_at).toBe(iso(NOW + 60_000));
    // input queue is immutable
    expect(q.cards.get(1)!.state).toBe('new');
  });

  it('shifts counts new -> learning when a new card is answered', () => {
    const q = buildQueue([makeCard(1, 'new', NOW)]);
    const next = applyReview(q, 1, 'learning', NOW + 60_000, NOW);

    expect(counts(next)).toEqual({ new: 0, learning: 1, review: 0 });
    expect(counts(q)).toEqual({ new: 1, learning: 0, review: 0 });
  });

  it('drops a card that graduates to review', () => {
    const q = buildQueue([makeCard(1, 'learning', NOW)]);
    const next = applyReview(q, 1, 'review', NOW + 86_400_000, NOW);

    expect(next.cards.has(1)).toBe(false);
    expect(counts(next)).toEqual({ new: 0, learning: 0, review: 0 });
  });

  it('drops a learning card whose new due crosses UTC midnight', () => {
    const q = buildQueue([makeCard(1, 'learning', NOW)]);
    const next = applyReview(q, 1, 'learning', startOfNextUtcDay(NOW), NOW);

    expect(next.cards.has(1)).toBe(false);
  });

  it('keeps a relearning card whose new due is still today', () => {
    const q = buildQueue([makeCard(1, 'review', NOW)]);
    const next = applyReview(q, 1, 'relearning', NOW + 2 * 60_000, NOW);

    expect(next.cards.get(1)!.state).toBe('relearning');
    expect(next.cards.size).toBe(1);
  });

  it('is a no-op when the id is not in the queue', () => {
    const q = buildQueue([makeCard(1, 'new', NOW)]);
    expect(applyReview(q, 999, 'learning', NOW + 60_000, NOW)).toBe(q);
  });
});

describe('showNext', () => {
  it('returns done when the queue is empty', () => {
    expect(showNext(buildQueue([]), NOW)).toEqual({ kind: 'done' });
  });

  it('prefers learning over review even when review is due sooner', () => {
    const review = makeCard(1, 'review', NOW - 5_000);
    const learning = makeCard(2, 'learning', NOW - 1_000);
    const q = buildQueue([review, learning]);

    expect(showNext(q, NOW)).toEqual({
      kind: 'card',
      card: learning,
      ahead: false,
    });
  });

  it('picks the smallest-due card within the same priority bucket', () => {
    const sooner = makeCard(1, 'review', NOW - 5_000);
    const later = makeCard(2, 'review', NOW - 1_000);
    const q = buildQueue([sooner, later]);

    expect(showNext(q, NOW)).toEqual({
      kind: 'card',
      card: sooner,
      ahead: false,
    });
  });

  it('prefers review over new', () => {
    const newCard = makeCard(1, 'new', NOW);
    const review = makeCard(2, 'review', NOW - 10_000);
    const q = buildQueue([newCard, review]);

    expect(showNext(q, NOW)).toEqual({
      kind: 'card',
      card: review,
      ahead: false,
    });
  });

  it('shows a new card when it is the only due-now card', () => {
    const newCard = makeCard(1, 'new', NOW);
    const q = buildQueue([newCard]);

    expect(showNext(q, NOW)).toEqual({
      kind: 'card',
      card: newCard,
      ahead: false,
    });
  });

  it('surfaces a learning card within the learn-ahead window', () => {
    const learning = makeCard(1, 'learning', NOW + LEARN_AHEAD_MS - 1_000);
    const q = buildQueue([learning]);

    expect(showNext(q, NOW)).toEqual({
      kind: 'card',
      card: learning,
      ahead: true,
    });
  });

  it('reports done when the only card is beyond the learn-ahead window', () => {
    const learning = makeCard(1, 'learning', NOW + 40 * 60 * 1000);
    const q = buildQueue([learning]);

    expect(showNext(q, NOW)).toEqual({ kind: 'done' });
  });

  it('does not learn-ahead a review card (reports done instead)', () => {
    const review = makeCard(1, 'review', NOW + 5 * 60 * 1000);
    const q = buildQueue([review]);

    expect(showNext(q, NOW)).toEqual({ kind: 'done' });
  });

  it('sets ahead:false for a strictly-due card and ahead:true for a learn-ahead-only card', () => {
    const dueNow = makeCard(1, 'review', NOW - 1_000);
    const learningAhead = makeCard(2, 'learning', NOW + 5 * 60 * 1000);
    const q = buildQueue([dueNow, learningAhead]);

    // The due-now card surfaces first with ahead:false.
    expect(showNext(q, NOW)).toEqual({
      kind: 'card',
      card: dueNow,
      ahead: false,
    });

    // With nothing strictly due, the learn-ahead card surfaces with ahead:true.
    const q2 = buildQueue([learningAhead]);
    expect(showNext(q2, NOW)).toEqual({
      kind: 'card',
      card: learningAhead,
      ahead: true,
    });
  });

  it('interleaves: when the top of the showable list is the just-answered card and another card is showable, show the other (both due now)', () => {
    const a = makeCard(1, 'learning', NOW - 1_000);
    const b = makeCard(2, 'learning', NOW);
    const q = buildQueue([a, b]);

    // No last-shown id => top of the list (a, smaller due).
    expect(showNext(q, NOW, undefined)).toEqual({
      kind: 'card',
      card: a,
      ahead: false,
    });

    // Just answered a => interleave to b.
    expect(showNext(q, NOW, a.id)).toEqual({
      kind: 'card',
      card: b,
      ahead: false,
    });
  });

  it('interleaves across the due-now / learn-ahead boundary', () => {
    // a due now, b learn-ahead within the window — both showable.
    const a = makeCard(1, 'learning', NOW);
    const b = makeCard(2, 'learning', NOW + 60_000);
    const q = buildQueue([a, b]);

    // Top is a (strictly due).
    const top = showNext(q, NOW, undefined);
    expect(top.kind).toBe('card');
    if (top.kind !== 'card') return;
    expect(top.card.id).toBe(a.id);
    // Just answered a => interleave to b (ahead:true).
    expect(showNext(q, NOW, a.id)).toEqual({
      kind: 'card',
      card: b,
      ahead: true,
    });
  });

  it('sole showable card repeats even when it was just answered', () => {
    const a = makeCard(1, 'learning', NOW);
    const q = buildQueue([a]);

    expect(showNext(q, NOW, a.id)).toEqual({
      kind: 'card',
      card: a,
      ahead: false,
    });
  });

  it('moving-clock sequence: done flips to a learn-ahead card within the 20-min window', () => {
    // One learning card due in 30 min — beyond the 20-min learn-ahead window
    // at t0, so the session reports done (completion-only model).
    const t0 = NOW;
    const learning = makeCard(1, 'learning', t0 + 30 * 60 * 1000);
    const q = buildQueue([learning]);

    const atT0 = showNext(q, t0);
    expect(atT0).toEqual({ kind: 'done' });

    // Advance the clock 11 minutes — now the card is 19 min out, within the
    // 20-min learn-ahead window. The session flips from done to a card,
    // surfaced via learn-ahead (ahead:true).
    const atT11 = showNext(q, t0 + 11 * 60 * 1000);
    expect(atT11).toEqual({
      kind: 'card',
      card: learning,
      ahead: true,
    });
  });
});
