export type DiffToken = {
  text: string;
  matched: boolean;
};

export type TranscriptComparison = {
  target: DiffToken[];
  spoken: DiffToken[];
  errorRate: number;
};

type Token = {
  text: string;
  normalized: string;
};

type AlignmentScore = {
  distance: number;
  matches: number;
};

type AlignmentOperation = 'delete' | 'insert' | 'diagonal';

type Alignment = {
  targetMatched: boolean[];
  spokenMatched: boolean[];
  distance: number;
};

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[.,!?;:"«»…]/g, '');
}

function tokenize(value: string): Token[] {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, normalized: normalizeToken(text) }))
    .filter((token) => token.normalized.length > 0);
}

export function normalizeTokens(value: string): string[] {
  return tokenize(value).map((token) => token.normalized);
}

function isBetterScore(
  candidate: AlignmentScore,
  current: AlignmentScore,
): boolean {
  return (
    candidate.distance < current.distance ||
    (candidate.distance === current.distance &&
      candidate.matches > current.matches)
  );
}

function alignTokens(target: string[], spoken: string[]): Alignment {
  const rows = target.length + 1;
  const cols = spoken.length + 1;
  const scores: AlignmentScore[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ distance: 0, matches: 0 })),
  );
  const operations: (AlignmentOperation | null)[][] = Array.from(
    { length: rows },
    () => Array<AlignmentOperation | null>(cols).fill(null),
  );

  for (let row = 1; row < rows; row += 1) {
    scores[row][0] = { distance: row, matches: 0 };
    operations[row][0] = 'delete';
  }
  for (let col = 1; col < cols; col += 1) {
    scores[0][col] = { distance: col, matches: 0 };
    operations[0][col] = 'insert';
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const matched = target[row - 1] === spoken[col - 1];
      const candidates: Array<{
        operation: AlignmentOperation;
        score: AlignmentScore;
      }> = [
        {
          operation: 'diagonal',
          score: {
            distance: scores[row - 1][col - 1].distance + (matched ? 0 : 1),
            matches: scores[row - 1][col - 1].matches + (matched ? 1 : 0),
          },
        },
        {
          operation: 'delete',
          score: {
            distance: scores[row - 1][col].distance + 1,
            matches: scores[row - 1][col].matches,
          },
        },
        {
          operation: 'insert',
          score: {
            distance: scores[row][col - 1].distance + 1,
            matches: scores[row][col - 1].matches,
          },
        },
      ];
      let best = candidates[0];
      for (const candidate of candidates.slice(1)) {
        if (isBetterScore(candidate.score, best.score)) best = candidate;
      }
      scores[row][col] = best.score;
      operations[row][col] = best.operation;
    }
  }

  const targetMatched = Array<boolean>(target.length).fill(false);
  const spokenMatched = Array<boolean>(spoken.length).fill(false);
  let row = target.length;
  let col = spoken.length;

  while (row > 0 || col > 0) {
    const operation = operations[row][col];
    if (operation === 'diagonal') {
      if (target[row - 1] === spoken[col - 1]) {
        targetMatched[row - 1] = true;
        spokenMatched[col - 1] = true;
      }
      row -= 1;
      col -= 1;
    } else if (operation === 'delete') {
      row -= 1;
    } else {
      col -= 1;
    }
  }

  return {
    targetMatched,
    spokenMatched,
    distance: scores[target.length][spoken.length].distance,
  };
}

export function wordErrorRate(target: string, spoken: string): number {
  const targetTokens = tokenize(target).map((token) => token.normalized);
  const spokenTokens = tokenize(spoken).map((token) => token.normalized);
  if (targetTokens.length === 0) return spokenTokens.length === 0 ? 0 : 1;
  const alignment = alignTokens(targetTokens, spokenTokens);
  return Math.min(1, alignment.distance / targetTokens.length);
}

export function compareTranscript(
  target: string,
  spoken: string,
): TranscriptComparison {
  const targetTokens = tokenize(target);
  const spokenTokens = tokenize(spoken);
  const alignment = alignTokens(
    targetTokens.map((token) => token.normalized),
    spokenTokens.map((token) => token.normalized),
  );

  return {
    target: targetTokens.map((token, index) => ({
      text: token.text,
      matched: alignment.targetMatched[index],
    })),
    spoken: spokenTokens.map((token, index) => ({
      text: token.text,
      matched: alignment.spokenMatched[index],
    })),
    errorRate:
      targetTokens.length === 0
        ? spokenTokens.length === 0
          ? 0
          : 1
        : Math.min(1, alignment.distance / targetTokens.length),
  };
}

export const K_PASS_ERROR_RATE = 0.2;

export function isTranscriptPassing(target: string, spoken: string): boolean {
  return wordErrorRate(target, spoken) <= K_PASS_ERROR_RATE;
}
