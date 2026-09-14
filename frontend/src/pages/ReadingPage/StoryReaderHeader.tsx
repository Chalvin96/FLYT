import { getCefrBadgeClassName } from '@/components/reading/readingDisplay';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function StoryReaderHeader({
  cefrLevel,
  groupTitle,
  title,
  titleId,
}: {
  cefrLevel: string | null;
  groupTitle: string | null;
  title: string;
  titleId: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {groupTitle ? (
          <span className="type-caption text-muted-foreground">
            {groupTitle}
          </span>
        ) : null}
        {cefrLevel ? (
          <Badge
            variant="outline"
            className={cn(
              'type-caption-sm font-semibold',
              getCefrBadgeClassName(cefrLevel),
            )}
          >
            {cefrLevel}
          </Badge>
        ) : null}
      </div>
      <h1 className="type-hero font-display" id={titleId}>
        {title}
      </h1>
    </div>
  );
}
