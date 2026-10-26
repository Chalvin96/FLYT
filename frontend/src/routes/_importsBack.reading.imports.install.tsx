import { createFileRoute } from '@tanstack/react-router';

import { routeErrorComponent } from '@/lib/routeErrorComponent';
import { ExtensionInstallPage } from '@/pages/ReadingPage/ExtensionInstallPage';

export const Route = createFileRoute('/_importsBack/reading/imports/install')({
  component: ExtensionInstallPage,
  errorComponent: routeErrorComponent(
    'Extension page failed',
    '/reading/imports',
  ),
});
