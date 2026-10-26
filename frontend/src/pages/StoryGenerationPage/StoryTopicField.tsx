import { Chip, Heading, Text } from '@flyt/ui';
import type { RefObject } from 'react';

import { STORY_GENERATION_TOPIC_MAX_CHARACTERS } from './constants';

export interface StoryTopicFieldProps {
  topic: string;
  error: string | null;
  suggestions: readonly string[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
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
      <legend>
        <Heading as="span" size="xxsmall" tone="subtle">
          About{' '}
        </Heading>
        <Text as="span" size="small" tone="subtle">
          optional
        </Text>
      </legend>
      <Text as="div" size="medium" tone="default">
        <textarea
          aria-describedby={
            error ? 'story-topic-error story-topic-hint' : 'story-topic-hint'
          }
          aria-invalid={error !== null}
          aria-label="Topic"
          lang="nb"
          maxLength={STORY_GENERATION_TOPIC_MAX_CHARACTERS}
          onChange={(event) => onTopicChange(event.target.value)}
          placeholder="Anything you like"
          ref={inputRef}
          rows={topic.length > 100 ? 6 : 2}
          value={topic}
          className={`block min-h-24 w-full resize-y radius-field border bg-overlay p-3 placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focused)] ${error ? 'border-danger' : 'border-strong-hovered'}`}
        />
      </Text>
      <div className="text-right">
        <Text as="p" size="small" tone="subtle" id="story-topic-hint">
          {topic.length}/{STORY_GENERATION_TOPIC_MAX_CHARACTERS} characters
        </Text>
      </div>
      {error ? (
        <Text as="p" size="small" tone="danger" id="story-topic-error">
          {error}
        </Text>
      ) : null}
      {suggestions.length > 0 ? (
        <div
          aria-label="Topic suggestions"
          className="flex flex-wrap gap-2"
          lang="nb"
        >
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              onClick={() => onSuggestionSelect(suggestion)}
              variant="suggestion"
            >
              {suggestion}
            </Chip>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
