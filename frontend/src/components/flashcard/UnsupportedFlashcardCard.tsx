import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';

type UnsupportedFlashcardCardProps = {
  cardType: string;
  isSubmitting: boolean;
  onContinue: () => void;
};

export function UnsupportedFlashcardCard({
  cardType,
  isSubmitting,
  onContinue,
}: UnsupportedFlashcardCardProps) {
  return (
    <AppCard className="flex min-h-0 flex-1 flex-col justify-between p-6">
      <div className="space-y-2">
        <h2 className="type-section font-semibold text-foreground">
          Unsupported lesson step
        </h2>
        <p className="type-caption text-muted-foreground">
          This lesson contains a step type ({cardType}) that is not available in
          this app version.
        </p>
      </div>
      <Button
        className="mt-4 w-full"
        disabled={isSubmitting}
        onClick={onContinue}
      >
        Continue
      </Button>
    </AppCard>
  );
}
