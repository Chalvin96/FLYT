import { Card, Heading, Text } from '@flyt/ui';
import type { ReactNode } from 'react';

export function LessonEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      <Card padding="roomy">
        <Text size="medium" tone="subtle">
          Lessons
        </Text>
        <div className="mt-2">
          <Heading as="h1" size="xlarge" tone="default">
            {title}
          </Heading>
        </div>
        <div className="mt-3">
          <Text size="medium" tone="subtle">
            {description}
          </Text>
        </div>
        {action ? <div className="mt-4">{action}</div> : null}
      </Card>
    </div>
  );
}
