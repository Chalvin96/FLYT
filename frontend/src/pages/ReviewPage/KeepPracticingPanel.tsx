import { Button, Heading, Text } from '@flyt/ui';
import { Link } from '@tanstack/react-router';

export interface KeepPracticingPanelProps {
  onAddMoreNew?: () => void;
  isAddMoreNewPending?: boolean;
}

export function KeepPracticingPanel({
  onAddMoreNew,
  isAddMoreNewPending = false,
}: KeepPracticingPanelProps) {
  return (
    <div className="w-full space-y-6 text-left">
      {onAddMoreNew ? (
        <section>
          <div className="mb-2 px-1">
            <Heading as="div" size="xxsmall" tone="subtle">
              Keep practicing
            </Heading>
          </div>
          <Button
            type="button"
            variant="outline"
            shape="pill"
            width="full"
            disabled={isAddMoreNewPending}
            onClick={onAddMoreNew}
          >
            Add more new words
          </Button>
        </section>
      ) : null}

      <div>
        <div className="mb-2 px-1">
          <Text as="div" size="medium" tone="subtle">
            Switch it up
          </Text>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button asChild variant="outline" shape="pill">
            <Link to="/lesson">Lesson</Link>
          </Button>
          <Button asChild variant="ghost" shape="pill">
            <Link to="/reading">Reading</Link>
          </Button>
          <Button asChild variant="ghost" shape="pill">
            <Link to="/review/cards">Cards</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
