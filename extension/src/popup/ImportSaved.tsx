import type { ReactNode } from "react";

import { Button, Text } from "@flyt/ui";

export function ImportFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex-none border-t border-default bg-[color-mix(in_srgb,var(--background-neutral)_55%,var(--surface-raised))] px-3.5 py-3">
      {children}
    </div>
  );
}

export function ImportSaved({ importsUrl }: { importsUrl: string }) {
  return (
    <div className="[&_p+p]:mt-0.5">
      <Text as="p" size="medium" tone="default" weight="semibold">
        Page saved
      </Text>
      <Text as="p" size="small" tone="subtle">
        We’ll prepare it for reading. You can keep browsing.
      </Text>
      <div className="mt-2">
        <Button asChild size="sm" variant="link">
          <a href={importsUrl} target="_blank" rel="noopener noreferrer">
            View in Flyt
          </a>
        </Button>
      </div>
    </div>
  );
}
