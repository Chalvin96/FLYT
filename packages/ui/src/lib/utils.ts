import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const TYPE_SCALE_SIZES = [
  'body-small',
  'body-medium',
  'body-large',
  'body-fluid',
  'heading-xxlarge',
  'heading-xlarge',
  'heading-large',
  'heading-medium',
  'heading-small',
  'heading-xsmall',
  'heading-xxsmall',
  'heading-fluid',
  'prompt',
];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: TYPE_SCALE_SIZES }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sentenceCaseLabel(
  value: string,
  source: 'text' | 'slug' = 'text',
): string {
  const words = (
    source === 'slug' ? value.replace(/[_-]+/g, ' ') : value
  ).trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
