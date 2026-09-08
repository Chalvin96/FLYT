import type {
  LessonDetailRead,
  LessonProgressRead,
  LessonSummaryRead,
} from '@/types/api';
import type { WriteJudgement } from '@/types/lesson-contracts';

import { client } from './client';

export async function listLessons(): Promise<LessonSummaryRead[]> {
  return (await client.get<LessonSummaryRead[]>('/lessons')).data;
}

export async function getLesson(id: number): Promise<LessonDetailRead> {
  return (await client.get<LessonDetailRead>(`/lessons/${id}`)).data;
}

export async function startLesson(id: number): Promise<LessonProgressRead> {
  return (await client.post<LessonProgressRead>(`/lessons/${id}/start`)).data;
}

export async function completeLessonExercise(
  lessonId: number,
  exerciseId: string,
): Promise<LessonProgressRead> {
  return (
    await client.post<LessonProgressRead>(
      `/lessons/${lessonId}/exercises/${encodeURIComponent(exerciseId)}/complete`,
    )
  ).data;
}

export async function completeLesson(id: number): Promise<void> {
  await client.post(`/lessons/${id}/complete`);
}

export async function judgeLessonWrite(
  lessonId: number,
  exerciseId: string,
  response: string,
): Promise<WriteJudgement> {
  return (
    await client.post<WriteJudgement>(
      `/lessons/${lessonId}/exercises/${encodeURIComponent(
        exerciseId,
      )}/judge-write`,
      { response },
    )
  ).data;
}
