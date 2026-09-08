import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import type { ImportFilterValue } from '@/components/reading/importDisplay';
import { IMPORT_FILTER_VALUES } from '@/components/reading/importDisplay';
import { ReadingImportsPage } from '@/pages/ReadingPage/ReadingImportsPage';

const IMPORT_FILTER_VALUE_SET = new Set<string>(IMPORT_FILTER_VALUES);

type ReadingImportsSearch = {
  status?: ImportFilterValue;
  q?: string;
};

function isImportFilterValue(value: unknown): value is ImportFilterValue {
  return typeof value === 'string' && IMPORT_FILTER_VALUE_SET.has(value);
}

function ReadingImportsRouteComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  return (
    <ReadingImportsPage
      filter={search.status ?? 'all'}
      q={search.q}
      onFilterChange={(filter) => {
        void navigate({
          to: '/reading/imports',
          search: (prev) => ({
            ...prev,
            status: filter === 'all' ? undefined : filter,
          }),
        });
      }}
      onSearchChange={(q) => {
        void navigate({
          to: '/reading/imports',
          search: (prev) => ({ ...prev, q }),
          replace: true,
        });
      }}
    />
  );
}

export const Route = createFileRoute('/_shell/reading/imports')({
  validateSearch: (search: Record<string, unknown>): ReadingImportsSearch => ({
    status: isImportFilterValue(search.status) ? search.status : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: ReadingImportsRouteComponent,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary
      error={error}
      reset={reset}
      homeTo="/home"
      title="Imports failed"
    />
  ),
});
