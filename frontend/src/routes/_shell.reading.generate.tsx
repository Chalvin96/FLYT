import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import {
  StoryGenerationPage,
  type StoryGenerationSearch,
} from '@/pages/StoryGenerationPage/StoryGenerationPage';

function parseLength(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function StoryGenerationRouteComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  return (
    <StoryGenerationPage
      search={search}
      onSearchChange={(patch) => {
        void navigate({
          to: '/reading/generate',
          replace: true,
          search: (previous) => ({ ...previous, ...patch }),
        });
      }}
    />
  );
}

export const Route = createFileRoute('/_shell/reading/generate')({
  validateSearch: (search: Record<string, unknown>): StoryGenerationSearch => ({
    provider: typeof search.provider === 'string' ? search.provider : undefined,
    anchor: typeof search.anchor === 'string' ? search.anchor : undefined,
    length: parseLength(search.length),
    topic: typeof search.topic === 'string' ? search.topic : undefined,
  }),
  component: StoryGenerationRouteComponent,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary
      error={error}
      reset={reset}
      homeTo="/home"
      title="Story generation failed"
    />
  ),
});
