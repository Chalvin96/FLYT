import { Button, Heading, Text } from '@flyt/ui';
import { LoaderCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export function StoryProcessingNotice() {
  return (
    <div
      className="mx-auto flex w-full max-w-prose flex-col items-center gap-4 px-2 pt-24 text-center"
      role="status"
    >
      <LoaderCircle
        className="icon-lg animate-spin text-icon-brand motion-reduce:animate-none"
        aria-hidden
      />
      <Heading as="h1" size="medium">
        Still preparing this text
      </Heading>
      <Text size="medium" tone="subtle">
        We&apos;re splitting it into pages and matching your words. This usually
        takes less than a minute. You can leave; it will be in Your imports.
      </Text>
      <Button asChild variant="outline">
        <Link to="/reading/imports">Back to your imports</Link>
      </Button>
    </div>
  );
}
