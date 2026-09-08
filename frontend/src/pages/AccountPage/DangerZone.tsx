import { Trash2 } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';

export interface DangerZoneProps {
  onDelete: () => void;
}

export function DangerZone({ onDelete }: DangerZoneProps) {
  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="radius-section border border-destructive-20 bg-destructive-0 p-4 sm:p-5"
    >
      <h2
        className="type-label-xs text-destructive-70"
        id="danger-zone-heading"
      >
        Delete account
      </h2>
      <p className="mt-1.5 max-w-[42ch] type-caption text-muted-foreground">
        Removes your account and everything in it. This cannot be undone.
      </p>
      <Button
        className="mt-4 w-full border-destructive-40 text-destructive-70 hover:bg-destructive-10 sm:w-auto"
        onClick={onDelete}
        type="button"
        variant="outline"
      >
        <Trash2 className="icon-sm" />
        Delete account
      </Button>
    </section>
  );
}
