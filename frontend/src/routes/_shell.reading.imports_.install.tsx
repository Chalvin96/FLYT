import { createFileRoute } from '@tanstack/react-router';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { ExtensionInstallPage } from '@/pages/ReadingPage/ExtensionInstallPage';

export const Route = createFileRoute('/_shell/reading/imports_/install')({
  component: ExtensionInstallPage,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary
      error={error}
      reset={reset}
      homeTo="/reading/imports"
      title="Extension page failed"
    />
  ),
});
