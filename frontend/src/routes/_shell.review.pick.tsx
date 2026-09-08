import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

function ReviewPickRouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ replace: true, search: { mode: 'full' }, to: '/review' });
  }, [navigate]);

  return null;
}

export const Route = createFileRoute('/_shell/review/pick')({
  component: ReviewPickRouteComponent,
});
