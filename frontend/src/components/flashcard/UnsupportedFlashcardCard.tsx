import { Button, Card, Heading, Text } from '@flyt/ui';

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
    <Card fillHeight padding="roomy">
      <div className="space-y-2">
        <Heading as="h2" size="medium">
          Unsupported lesson step
        </Heading>
        <Text size="medium" tone="subtle">
          This lesson contains a step type ({cardType}) that is not available in
          this app version.
        </Text>
      </div>
      <div className="mt-4">
        <Button disabled={isSubmitting} onClick={onContinue} width="full">
          Continue
        </Button>
      </div>
    </Card>
  );
}
