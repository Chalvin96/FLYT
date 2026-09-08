import type { LucideIcon } from 'lucide-react';
import { BookMarked, BookOpenText, Dumbbell, House } from 'lucide-react';

export type AppNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export const appNavItems = [
  { label: 'Home', to: '/home', icon: House },
  { label: 'Lesson', to: '/lesson', icon: BookMarked },
  { label: 'Practice', to: '/review', icon: Dumbbell },
  { label: 'Reading', to: '/reading', icon: BookOpenText },
] as const satisfies readonly AppNavItem[];

export type AppNavPath = (typeof appNavItems)[number]['to'];
