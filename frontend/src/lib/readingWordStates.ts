import type { ReadingWordState } from '@/types/api';

export function collectLatestWordStates(
  snapshots: readonly {
    updatedAt: number;
    states: readonly (readonly [string, ReadingWordState])[];
  }[],
): ReadonlyMap<string, ReadingWordState> {
  const states = new Map<string, ReadingWordState>();
  for (const snapshot of [...snapshots].sort(
    (a, b) => a.updatedAt - b.updatedAt,
  ))
    for (const [uuid, state] of snapshot.states) states.set(uuid, state);
  return states;
}
