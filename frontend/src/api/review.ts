import type {
  DeckSummaryItem,
  EmptyResponse,
  ReviewResult,
  ReviewSubmissionBody,
  UserCard,
} from '@/types/api';

import { client } from './client';

export async function listDecks(): Promise<DeckSummaryItem[]> {
  return (await client.get<DeckSummaryItem[]>('/me/decks')).data;
}

export async function reviewCard(
  userCardId: number,
  submission: ReviewSubmissionBody,
  cardId: number,
): Promise<ReviewResult> {
  return (
    await client.post<ReviewResult>(`/me/cards/${userCardId}/review`, {
      ...submission,
      card_id: cardId,
    })
  ).data;
}

export async function subscribeToDeck(deckId: number): Promise<void> {
  await client.post(`/me/decks/${deckId}/subscribe`);
}

export async function addLemmaToDeck(
  lemmaUuid: string,
): Promise<EmptyResponse> {
  return (
    await client.post<EmptyResponse>(
      `/me/cards/lemmas/${lemmaUuid}/add-to-deck`,
    )
  ).data;
}

export async function addMoreNew(): Promise<{ promoted: number }> {
  return (await client.post('/me/cards/add-more-new')).data;
}

export async function getDueCards(
  mode: 'quick' | 'full' = 'full',
): Promise<UserCard[]> {
  return (
    await client.get<UserCard[]>('/me/cards/due', {
      params: { mode },
    })
  ).data;
}
