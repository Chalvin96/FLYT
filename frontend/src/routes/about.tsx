import { createFileRoute } from '@tanstack/react-router';

import { AboutPage } from '@/pages/AboutPage/AboutPage';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});
