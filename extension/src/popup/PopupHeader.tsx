import { Button, Text } from "@flyt/ui";
import { Search, X } from "lucide-react";

import { FlytMark } from "./FlytMark";

export function PopupHeader({
  onClose,
  onSearch,
  searching,
}: {
  onClose?: () => void;
  onSearch?: () => void;
  searching: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 py-2">
      <FlytMark />
      <Text as="span" size="medium" tone="default" weight="semibold">
        Flyt
      </Text>
      <div className="ml-auto flex items-center gap-2">
        {onSearch && (
          <Button
            aria-label="Search"
            aria-pressed={searching}
            onClick={onSearch}
            size="icon-sm"
            variant={searching ? "secondary" : "ghost"}
          >
            <Search aria-hidden="true" />
          </Button>
        )}
        {onClose && (
          <Button
            aria-label="Close"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
