import { PlusCircle } from 'lucide-react';

import { Button } from '@/components/common/Button/Button';
import { IconWell } from '@/components/common/IconWell/IconWell';

export interface KeepPracticingPanelProps {
  onAddMoreNew?: () => void;
  isAddMoreNewPending?: boolean;
}

export function KeepPracticingPanel({
  onAddMoreNew,
  isAddMoreNewPending = false,
}: KeepPracticingPanelProps) {
  if (!onAddMoreNew) {
    return null;
  }

  return (
    <section className="w-full text-left">
      <div className="mb-2 px-1 type-caption font-medium tracking-[0.08em] text-muted-foreground">
        Keep practicing
      </div>
      <Button
        type="button"
        variant="outline"
        className="flex h-11 w-full items-center gap-2 rounded-full"
        disabled={isAddMoreNewPending}
        onClick={onAddMoreNew}
      >
        <IconWell
          size="sm"
          tone="accent"
          icon={PlusCircle}
          iconProps={{ strokeWidth: 1.9 }}
        />
        Add more new words
      </Button>
    </section>
  );
}
