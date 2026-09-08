import type {
  Block,
  Exercise,
  LessonPacket,
  SectionPacket,
} from '@/types/lesson-contracts';

export type SectionLessonPage = {
  kind: 'section';
  /** App-local; never a progress key. */
  id: string;
  sectionId: string;
  role: SectionPacket['role'];
  title: string;
  blocks: Block[];
};

export type ExerciseLessonPage = {
  kind: 'exercise';
  id: string;
  exerciseId: string;
  exercise: Exercise;
};

export type LessonPage = SectionLessonPage | ExerciseLessonPage;

export function kindPosition(
  pages: LessonPage[],
  index: number,
): { position: number; total: number } {
  const page = pages[index];
  const ofKind = pages.filter((candidate) => candidate.kind === page?.kind);
  return { position: ofKind.indexOf(page) + 1, total: ofKind.length };
}

export function deriveLessonPages(packet: LessonPacket): LessonPage[] {
  if (!packet.content) {
    throw new Error('packet content is missing');
  }
  const sectionsById = new Map(packet.sections.map((s) => [s.id, s]));
  const exercisesById = new Map(packet.exercises.map((e) => [e.id, e]));
  const pages: LessonPage[] = [];
  const seen = new Set<string>();

  packet.content.forEach((reference, index) => {
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) {
      throw new Error(`duplicate content reference ${reference.id}`);
    }
    seen.add(key);
    if (reference.kind === 'section') {
      const section = sectionsById.get(reference.id);
      if (!section) {
        throw new Error(`content references unknown section ${reference.id}`);
      }
      pages.push({
        kind: 'section',
        id: `page-${index}`,
        sectionId: section.id,
        role: section.role,
        title: section.title,
        blocks: section.blocks,
      });
      return;
    }
    const exercise = exercisesById.get(reference.id);
    if (!exercise) {
      throw new Error(`content references unknown exercise ${reference.id}`);
    }
    pages.push({
      kind: 'exercise',
      id: `page-${index}`,
      exerciseId: exercise.id,
      exercise,
    });
  });

  const omitted: string[] = [];
  for (const section of packet.sections) {
    if (!seen.has(`section:${section.id}`)) omitted.push(section.id);
  }
  for (const exercise of packet.exercises) {
    if (!seen.has(`exercise:${exercise.id}`)) omitted.push(exercise.id);
  }
  if (omitted.length > 0) {
    throw new Error(`content omits ${omitted[0]}`);
  }

  return pages;
}

export function packetExerciseIds(packet: LessonPacket): string[] {
  return packet.content.reduce<string[]>((ids, reference) => {
    if (reference.kind === 'exercise') ids.push(reference.id);
    return ids;
  }, []);
}
