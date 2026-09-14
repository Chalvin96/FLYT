import { StoryCard } from '@/components/reading/StoryCard';
import type { ReadingStorySummary } from '@/types/api';

export function StoryEndSection({
  recommendations,
}: {
  recommendations: readonly ReadingStorySummary[];
}) {
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <p className="type-caption text-muted-foreground">
        You&apos;ve reached the end of this story.
      </p>
      {recommendations.length > 0 ? (
        <div className="space-y-3">
          <h2 className="type-section">Continue Reading</h2>
          <div className="space-y-3">
            {recommendations.map((story) => (
              <StoryCard
                key={story.uuid}
                story={story}
                variant="recommendation"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
