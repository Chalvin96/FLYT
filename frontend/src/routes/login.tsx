import { createFileRoute, redirect, useSearch } from '@tanstack/react-router';

import { meQueryOptions } from '@/hooks/auth/queries';
import { LoginPage } from '@/pages/LoginPage/LoginPage';

const LOGIN_ERROR_CODES = ['state', 'provider', 'internal'] as const;

type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

function isLoginErrorCode(value: unknown): value is LoginErrorCode {
  return (
    typeof value === 'string' &&
    LOGIN_ERROR_CODES.includes(value as LoginErrorCode)
  );
}

function LoginRoute() {
  const { error, deleted } = useSearch({ strict: false }) as {
    error?: LoginErrorCode;
    deleted?: boolean;
  };
  return <LoginPage deleted={deleted} error={error} />;
}

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(meQueryOptions);
    } catch {
      return;
    }
    throw redirect({ to: '/home' });
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): { error?: LoginErrorCode; deleted?: boolean } => ({
    error: isLoginErrorCode(s.error) ? s.error : undefined,
    deleted: s.deleted === true || s.deleted === 'true' ? true : undefined,
  }),
  component: LoginRoute,
});
