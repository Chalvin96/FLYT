import { useRef, useState } from 'react';

import type {
  AddLemmasRequest,
  AddLemmasResult,
} from '@/hooks/lexicon/queries';

import type { StoryLookupWord } from './storyCompletion';

export type ReviewAddition =
  | { kind: 'idle'; added: readonly string[] }
  | {
      kind: 'pending';
      added: readonly string[];
      completed: number;
      total: number;
    }
  | { kind: 'settled'; added: readonly string[]; failed: readonly string[] };

export function useStoryWordReview(
  lookups: readonly StoryLookupWord[],
  addWords: (request: AddLemmasRequest) => Promise<AddLemmasResult>,
) {
  const [addition, setAddition] = useState<ReviewAddition>({
    kind: 'idle',
    added: [],
  });
  const running = useRef(false);
  const added = new Set(addition.added);
  const failed =
    addition.kind === 'settled' && addition.failed.length > 0
      ? new Set(addition.failed)
      : undefined;
  const eligible = lookups.flatMap((word) =>
    word.state === 'new' &&
    word.lemmaUuid !== null &&
    !added.has(word.lemmaUuid) &&
    (!failed || failed.has(word.lemmaUuid))
      ? [word.lemmaUuid]
      : [],
  );
  const add = async () => {
    if (running.current || eligible.length === 0) return;
    running.current = true;
    const retained = addition.added;
    setAddition({
      kind: 'pending',
      added: retained,
      completed: 0,
      total: eligible.length,
    });
    try {
      const result = await addWords({
        lemmaUuids: eligible,
        onProgress: (completed, total) =>
          setAddition({ kind: 'pending', added: retained, completed, total }),
      });
      setAddition({
        kind: 'settled',
        added: [...retained, ...result.added],
        failed: result.failed,
      });
    } catch {
      setAddition({ kind: 'settled', added: retained, failed: eligible });
    } finally {
      running.current = false;
    }
  };
  return { addition, eligible, add };
}
