import { Button, Heading, Text } from '@flyt/ui';
import { Trash2 } from 'lucide-react';

export interface DangerZoneProps {
  onDelete: () => void;
}

export function DangerZone({ onDelete }: DangerZoneProps) {
  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="radius-section border border-danger-subtle bg-danger-subtle p-4 sm:p-5"
    >
      <div className="text-danger">
        <Heading as="h2" id="danger-zone-heading" size="xxsmall">
          Delete account
        </Heading>
      </div>
      <div className="mt-1.5 max-w-[42ch]">
        <Text as="p" size="medium" tone="subtle">
          Removes your account and everything in it. This cannot be undone.
        </Text>
      </div>
      <div className="mt-4">
        <Button
          onClick={onDelete}
          type="button"
          variant="danger"
          width="full-on-mobile"
        >
          <Trash2 className="icon-sm" />
          Delete account
        </Button>
      </div>
    </section>
  );
}
