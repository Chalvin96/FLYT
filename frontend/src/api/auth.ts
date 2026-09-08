import { config } from '@/config';
import type { UserRead, UserUpdate } from '@/types/api';

import { client } from './client';

export const googleStartUrl = (): string =>
  `${config.apiUrl}/users/oauth/google/start`;

export async function logout(): Promise<void> {
  await client.post('/users/logout');
}

export async function getMe(): Promise<UserRead> {
  return (await client.get<UserRead>('/users/me')).data;
}

export async function updateMe(payload: UserUpdate): Promise<UserRead> {
  return (await client.patch<UserRead>('/users/me', payload)).data;
}
