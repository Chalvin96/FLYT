import { Skeleton, Text } from "@flyt/ui";

export function LoadingView({ word }: { word: string }) {
  return (
    <div
      className="flex flex-col gap-4 px-4 pb-4 pt-5"
      role="status"
      aria-label={`Looking up ${word}`}
    >
      <div className="flex items-center gap-3">
        <Text as="h2" size="2xl" weight="bold">
          {word}
        </Text>
        <div className="w-12">
          <Skeleton length="full" />
        </div>
      </div>
      <Skeleton length="short" />
      <div className="w-24">
        <Skeleton variant="heading" size="sm" length="full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton length="full" />
        <Skeleton length="long" />
        <Skeleton length="medium" />
      </div>
    </div>
  );
}

export function LoadingActions() {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-default px-4 py-3">
      <Skeleton variant="control" />
      <Skeleton variant="control" />
    </div>
  );
}
