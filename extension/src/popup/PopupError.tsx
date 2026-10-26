import { Button, Text } from "@flyt/ui";
import { CircleAlert } from "lucide-react";

import { SignInButton } from "./PopupActions";
import { buildPopupError, type PopupFailure } from "./buildPopupError";

const APP_ORIGIN = (
  import.meta.env.VITE_APP_ORIGIN ?? "http://localhost:5173"
).replace(/\/$/, "");

export function LookupError({
  failure,
  word,
}: {
  failure: PopupFailure;
  word?: string;
}) {
  return (
    <>
      {failure.error !== "permission" && word && (
        <div className="px-4 pt-5">
          <Text as="h2" size="2xl" weight="bold">
            {word}
          </Text>
        </div>
      )}
      <ErrorMessage failure={failure} />
    </>
  );
}

export function ErrorMessage({ failure }: { failure: PopupFailure }) {
  return (
    <div role="alert" className="flex items-start gap-2 px-4 py-4">
      {failure.error !== "permission" && (
        <CircleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-icon-danger"
        />
      )}
      <Text size="medium" tone="default">
        {buildPopupError(failure).message}
      </Text>
    </div>
  );
}

export function ErrorActions({
  failure,
  onRetry,
}: {
  failure: PopupFailure;
  onRetry: () => void;
}) {
  const { retry, openFlyt } = buildPopupError(failure);
  if (failure.error === "unauthorized") {
    return (
      <div className="border-t border-default p-4">
        <SignInButton onDone={onRetry} />
      </div>
    );
  }
  if (!retry && !openFlyt) return null;
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-default px-4 py-3">
      {openFlyt && (
        <Button
          asChild
          variant={retry ? "ghost" : "outline"}
          width={retry ? "auto" : "full"}
        >
          <a href={APP_ORIGIN} target="_blank" rel="noopener noreferrer">
            Open Flyt
          </a>
        </Button>
      )}
      {retry && (
        <div className="min-w-0 flex-1">
          <Button onClick={onRetry} width="full">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
