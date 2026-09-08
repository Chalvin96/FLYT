import type { ReadingStoryToken, ReadingWordState } from '@/types/api';

export type StoryParagraphSegment = {
  text: string;
  lemmaUuid: string | null;
  state: ReadingWordState;
  isToken: boolean;
};

export type StoryParagraph = StoryParagraphSegment[];

type Annotated = { content: string; tokens: ReadingStoryToken[] };

function isParagraphBreak(text: string): boolean {
  return /^\n{2,}$/.test(text);
}

function buildStorySegments(
  source: Annotated,
  userStates: Record<string, ReadingWordState>,
): StoryParagraphSegment[] {
  const segments: StoryParagraphSegment[] = [];
  let cursor = 0;

  for (const token of source.tokens) {
    if (token.start > cursor) {
      segments.push({
        text: source.content.slice(cursor, token.start),
        lemmaUuid: null,
        state: 'mastered',
        isToken: false,
      });
    }

    segments.push({
      text: source.content.slice(token.start, token.end),
      lemmaUuid: token.lemmaUuid,
      state: token.lemmaUuid ? (userStates[token.lemmaUuid] ?? 'new') : 'new',
      isToken: true,
    });
    cursor = token.end;
  }

  if (cursor < source.content.length) {
    segments.push({
      text: source.content.slice(cursor),
      lemmaUuid: null,
      state: 'mastered',
      isToken: false,
    });
  }

  return segments;
}

function splitParagraphs(segments: StoryParagraphSegment[]): StoryParagraph[] {
  const paragraphs: StoryParagraph[] = [[]];

  for (const segment of segments) {
    if (segment.isToken) {
      paragraphs[paragraphs.length - 1].push(segment);
      continue;
    }

    for (const textPart of segment.text.split(/(\n{2,})/)) {
      if (!textPart) {
        continue;
      }

      if (isParagraphBreak(textPart)) {
        if (paragraphs[paragraphs.length - 1].length > 0) {
          paragraphs.push([]);
        }
        continue;
      }

      paragraphs[paragraphs.length - 1].push({
        text: textPart,
        lemmaUuid: null,
        state: 'mastered',
        isToken: false,
      });
    }
  }

  return paragraphs.filter((paragraph) =>
    paragraph.some(
      (segment) => segment.lemmaUuid !== null || segment.text.trim() !== '',
    ),
  );
}

export function buildStoryParagraphs(
  source: Annotated,
  userStates: Record<string, ReadingWordState>,
): StoryParagraph[] {
  return splitParagraphs(buildStorySegments(source, userStates));
}
