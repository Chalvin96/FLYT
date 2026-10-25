import { useEffect, useState } from "react";
import { Button, Heading, Text } from "@flyt/ui";

import { hasSiteAccess, requestSiteAccess } from "../lib/permissions";

type AccessStatus =
  "checking" | "idle" | "requesting" | "granted" | "denied" | "error";

const STATUS_MESSAGE: Record<AccessStatus, string> = {
  checking: "Checking website access…",
  idle: "",
  requesting: "Waiting for permission…",
  granted: "FlytLese can read pages. Reload the page you were reading.",
  denied:
    "Website access was not allowed. Click Allow access to websites to try again.",
  error: "Could not confirm website access. Try again.",
};

export function SiteAccessPage() {
  const [status, setStatus] = useState<AccessStatus>("checking");

  useEffect(() => {
    void hasSiteAccess()
      .then((granted) => setStatus(granted ? "granted" : "idle"))
      .catch(() => setStatus("error"));
  }, []);

  const handleAllow = async () => {
    setStatus("requesting");
    try {
      const { granted } = await requestSiteAccess();
      setStatus(granted ? "granted" : "denied");
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-neutral px-6 py-12 text-default">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="space-y-3">
          <Heading as="h1" size="large">
            Website access
          </Heading>
          <Text size="large">
            FlytLese needs access to websites to look up words, translate
            selections, and import pages.
          </Text>
        </header>
        <div className="space-y-3">
          {status !== "granted" && (
            <Button
              width="full-on-mobile"
              disabled={status === "checking" || status === "requesting"}
              onClick={() => void handleAllow()}
            >
              Allow access to websites
            </Button>
          )}
          <div role="status">
            <Text size="medium">{STATUS_MESSAGE[status]}</Text>
          </div>
        </div>
        <section aria-labelledby="site-access-privacy" className="space-y-3">
          <Heading as="h2" size="small" id="site-access-privacy">
            What is sent to Flyt
          </Heading>
          <Text size="medium" tone="subtle">
            When you use these features, Flyt receives dictionary searches and
            selected text. Saving a word can also send its sentence and page
            title.
          </Text>
          <Text size="medium" tone="subtle">
            When you import a page, Flyt receives its URL, title, and readable
            text. Your Flyt session token is used for actions that need your
            account.
          </Text>
        </section>
      </div>
    </main>
  );
}
