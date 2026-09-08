import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/words')({
  beforeLoad: () => {
    throw redirect({ to: '/review/cards', replace: true });
  },
});
