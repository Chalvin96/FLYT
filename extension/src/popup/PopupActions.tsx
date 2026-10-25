import { useState } from "react";
import { Button, Text } from "@flyt/ui";
import { MSG_KIND, MSG_RESULT_KIND, sendMessage } from "../lib/messages";

export function SignInButton({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const signIn = async () => {
    setStatus("pending");
    try {
      const result = await sendMessage({ kind: MSG_KIND.SIGN_IN });
      const signedIn = result.ok && result.kind === MSG_RESULT_KIND.SIGNED_IN;
      if (signedIn) onDone();
      setStatus(signedIn ? "idle" : "error");
    } catch {
      setStatus("error");
    }
  };
  return (
    <Button
      width="full"
      disabled={status === "pending"}
      onClick={() => void signIn()}
    >
      {status === "pending"
        ? "Signing in…"
        : status === "error"
          ? "Try again"
          : "Sign in to Flyt"}
    </Button>
  );
}

export function SignInPrompt() {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-3 px-4 pb-4 pt-3">
      <Text size="medium" tone="default">
        {done
          ? "Signed in? Right-click the word again."
          : "Sign in to look up words and save them to your review queue."}
      </Text>
      {!done && <SignInButton onDone={() => setDone(true)} />}
    </div>
  );
}
