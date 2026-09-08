import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export async function flipCard(): Promise<void> {
  await userEvent.click(
    screen.getByRole('button', { name: /^(show|check) answer$/i }),
  );
}

export async function clickCardRating(
  rating: 'again' | 'hard' | 'good' | 'easy',
): Promise<void> {
  const buttonName = rating.charAt(0).toUpperCase() + rating.slice(1);
  await userEvent.click(
    screen.getByRole('button', { name: new RegExp(buttonName, 'i') }),
  );
}

export async function waitForDebounce(ms: number = 350): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
