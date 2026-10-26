import { Button, Text } from "@flyt/ui";

import { SignInButton } from "./PopupActions";
import type { useLemmaCandidates } from "./useLemmaCandidates";

export function LemmaActions({
  candidates,
  hasContext,
}: {
  candidates: ReturnType<typeof useLemmaCandidates>;
  hasContext: boolean;
}) {
  const candidate = candidates.active;
  if (!candidate) return null;
  const status = candidates.getStatus(candidate);
  const saving = status.kind === "saving";
  return (
    <div className="shrink-0 space-y-3 border-t border-default px-4 py-3">
      {status.kind === "error" && (
        <div role="alert" className="space-y-2">
          <Text size="small">
            {status.failure.error === "unauthorized"
              ? "Sign in to save this word."
              : "Could not save this word. Try again."}
          </Text>
          {status.failure.error === "unauthorized" ? (
            <SignInButton
              onDone={() => void candidates.act(candidate, status.action)}
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void candidates.act(candidate, status.action)}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          width="full"
          disabled={saving || status.state === "mastered"}
          onClick={() => void candidates.act(candidate, "know")}
        >
          {saving && status.action === "know"
            ? "Saving…"
            : status.state === "mastered"
              ? "Known"
              : "I already know this"}
        </Button>
        <Button
          width="full"
          disabled={
            saving ||
            status.state === "mastered" ||
            (status.state === "learning" && !hasContext)
          }
          onClick={() => void candidates.act(candidate, "add")}
        >
          {saving && status.action === "add"
            ? "Saving…"
            : status.state === "learning"
              ? "Added"
              : "Add to review"}
        </Button>
      </div>
    </div>
  );
}
