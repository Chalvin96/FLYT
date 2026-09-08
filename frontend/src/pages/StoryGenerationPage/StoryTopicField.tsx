import { Input } from '@flyt/ui';
import type { RefObject } from 'react';

import { STORY_GENERATION_TOPIC_MAX_CHARACTERS } from './constants';

export interface StoryTopicFieldProps {
  topic: string;
  error: string | null;
  suggestions: readonly string[];
  inputRef: RefObject<HTMLInputElement | null>;
  onTopicChange: (value: string) => void;
  onSuggestionSelect: (suggestion: string) => void;
}

export function StoryTopicField({
  topic,
  error,
  suggestions,
  inputRef,
  onTopicChange,
  onSuggestionSelect,
}: StoryTopicFieldProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="type-label text-muted-foreground">
        About{' '}
        <span className="font-normal normal-case tracking-normal">
          optional
        </span>
      </legend>
      <Input
        aria-describedby={
          error ? 'story-topic-error story-topic-hint' : 'story-topic-hint'
        }
        aria-invalid={error !== null}
        aria-label="Topic"
        className="h-11 bg-white-100 type-body"
        maxLength={STORY_GENERATION_TOPIC_MAX_CHARACTERS}
        onChange={(event) => onTopicChange(event.target.value)}
        placeholder="Anything you like"
        ref={inputRef}
        value={topic}
      />
      <p
        className="text-right type-caption-sm text-muted-foreground"
        id="story-topic-hint"
      >
        {topic.length}/{STORY_GENERATION_TOPIC_MAX_CHARACTERS} characters
      </p>
      {error ? (
        <p
          className="type-caption-sm text-destructive-70"
          id="story-topic-error"
        >
          {error}
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <div aria-label="Topic suggestions" className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              className="radius-field border border-dashed border-secondary-30 bg-transparent px-3 py-1.5 text-left type-caption-sm text-secondary-70 transition-colors hover:border-primary-60 hover:bg-secondary-10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={suggestion}
              onClick={() => onSuggestionSelect(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
