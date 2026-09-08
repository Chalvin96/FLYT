import { googleStartUrl } from '@/api/auth';
import { ErrorMessage } from '@/components/common/ErrorMessage/ErrorMessage';

const ERROR_MESSAGES: Record<string, string> = {
  state: 'Sign-in expired. Please try again.',
  provider: "We couldn't verify your Google account. Try a different account.",
  internal: 'Something went wrong. Please try again.',
};

const PRIVACY_POLICY_URL = '/about#privacy';

export interface LoginPageProps {
  error?: string;
  deleted?: boolean;
}

export function LoginPage({ error, deleted }: LoginPageProps = {}) {
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[420px] radius-section bg-white-100 p-8 shadow-raised sm:p-10">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-primary-70" />
          <span className="font-display type-section font-semibold tracking-tight text-foreground">
            Flyt
          </span>
        </div>

        {deleted && (
          <p
            className="mt-6 radius-field border border-border bg-secondary-10 p-3 type-caption text-foreground"
            role="status"
          >
            Your account has been deleted.
          </p>
        )}

        <h1 className="mt-8 type-title text-foreground">
          Start learning Norwegian.
        </h1>
        <p className="mt-2 type-body text-muted-foreground">
          Sign in with Google to begin or continue your Flyt practice.
        </p>

        {errorMessage && (
          <ErrorMessage
            error={errorMessage}
            title="Sign-in failed"
            className="mt-4"
          />
        )}

        <a
          className="mt-7 flex h-11 w-full items-center justify-center gap-3 radius-field border border-border bg-white-100 type-caption font-semibold text-foreground transition-colors hover:bg-secondary-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={googleStartUrl()}
        >
          <svg aria-hidden viewBox="0 0 18 18" className="size-[18px]">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
              fill="#EA4335"
            />
          </svg>
          <span>Sign in with Google</span>
        </a>

        <p className="mt-4 text-center type-caption-sm text-muted-foreground">
          By continuing you agree to the{' '}
          <a className="underline" href={PRIVACY_POLICY_URL}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

LoginPage.displayName = 'LoginPage';
