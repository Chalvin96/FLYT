import type { Components } from 'react-markdown';
import { Component, Suspense, useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { BubbleContent } from '@/components/chatbot/ui/bubble';
import { logClientError } from '@/lib/errors';
import { LazyMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

const chatbotMarkdownComponents: Components = {
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-muted-foreground">{children}</del>
  ),
  a: ({ children, href }) => {
    const safeLink = resolveChatbotLink(href);

    if (!safeLink) {
      return <span>{children}</span>;
    }

    return (
      <a
        className="font-medium text-secondary-70 underline underline-offset-2"
        href={safeLink.href}
        {...(safeLink.isExternal
          ? { rel: 'noopener noreferrer', target: '_blank' }
          : {})}
      >
        {children}
        {safeLink.isExternal ? (
          <span className="sr-only"> Opens in a new tab.</span>
        ) : null}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5" role="list">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5" role="list">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  h1: ChatbotMarkdownHeading,
  h2: ChatbotMarkdownHeading,
  h3: ChatbotMarkdownHeading,
  h4: ChatbotMarkdownHeading,
  h5: ChatbotMarkdownHeading,
  h6: ChatbotMarkdownHeading,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-t border-border" />,
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto">
      <table className="min-w-full border-collapse type-caption-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-secondary-10">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5">{children}</td>,
  img: ({ alt, src }) => {
    const safeSrc = resolveSameOriginImageSource(src);

    if (!safeSrc) {
      return null;
    }

    return <ChatbotMarkdownImage alt={alt} src={safeSrc} />;
  },
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono type-caption-sm text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      className="overflow-x-auto radius-field bg-muted p-3 type-caption-sm leading-6"
      tabIndex={0}
    >
      {children}
    </pre>
  ),
};

const chatbotMarkdownAllowedElements = [
  'p',
  ...Object.keys(chatbotMarkdownComponents),
];

function resolveSameOriginImageSource(src: string | undefined) {
  if (!src || typeof window === 'undefined') return undefined;

  try {
    const url = new URL(src, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return url.origin === window.location.origin ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function resolveChatbotLink(href: string | undefined) {
  if (!href || typeof window === 'undefined') return undefined;

  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }

    return {
      href: url.href,
      isExternal: url.origin !== window.location.origin,
    };
  } catch {
    return undefined;
  }
}

function ChatbotMarkdownHeading({ children }: { children?: ReactNode }) {
  return (
    <h3 className="font-display type-body font-semibold text-foreground">
      {children}
    </h3>
  );
}

function ChatbotMarkdownImage({ alt, src }: { alt?: string; src: string }) {
  const [imageState, setImageState] = useState<{
    src: string;
    status: 'pending' | 'loaded' | 'error';
  }>({ src, status: 'pending' });
  const state = imageState.src === src ? imageState.status : 'pending';
  const setImageRef = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete) {
        setImageState({
          src,
          status: image.naturalWidth > 0 ? 'loaded' : 'error',
        });
      }
    },
    [src],
  );

  const setImageStatus = (status: 'loaded' | 'error') => {
    setImageState({ src, status });
  };

  if (state === 'error') {
    return (
      <span className="type-caption-sm text-muted-foreground">
        {alt ? `Image unavailable — ${alt}` : 'Image unavailable'}
      </span>
    );
  }

  return (
    <span className="relative block min-h-40 max-w-full">
      {state === 'pending' ? (
        <span
          aria-hidden="true"
          className="import-cover-shimmer absolute inset-0 block min-h-40 w-full max-w-full overflow-hidden radius-field bg-secondary-10"
          data-testid="chatbot-markdown-image-loading"
        />
      ) : null}
      <img
        alt={alt ?? ''}
        className={cn(
          'block h-auto max-h-72 w-auto max-w-full radius-field object-contain',
          state === 'loaded' ? 'opacity-100 transition-opacity' : 'opacity-0',
        )}
        decoding="async"
        loading="lazy"
        onError={() => setImageStatus('error')}
        onLoad={() => setImageStatus('loaded')}
        ref={setImageRef}
        referrerPolicy="no-referrer"
        src={src}
      />
    </span>
  );
}

function ChatbotMarkdownSkeleton() {
  return (
    <span
      aria-hidden="true"
      className="block space-y-2"
      data-testid="chatbot-markdown-skeleton"
    >
      <span className="block h-3 w-11/12 animate-pulse radius-field bg-muted" />
      <span className="block h-3 w-4/5 animate-pulse radius-field bg-muted" />
      <span className="block h-3 w-3/5 animate-pulse radius-field bg-muted" />
    </span>
  );
}

export function ChatbotMessageMarkdown({ children }: { children: string }) {
  return (
    <BubbleContent className="mt-1 min-w-0 break-words type-body leading-7 text-foreground [&>*+*]:mt-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
      <ChatbotMarkdownErrorBoundary
        fallback={
          <span className="whitespace-pre-wrap break-words">{children}</span>
        }
      >
        <Suspense fallback={<ChatbotMarkdownSkeleton />}>
          <LazyMarkdown
            allowedElements={chatbotMarkdownAllowedElements}
            components={chatbotMarkdownComponents}
            skipHtml
          >
            {children}
          </LazyMarkdown>
        </Suspense>
      </ChatbotMarkdownErrorBoundary>
    </BubbleContent>
  );
}

interface ChatbotMarkdownErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ChatbotMarkdownErrorBoundaryState {
  hasError: boolean;
}

class ChatbotMarkdownErrorBoundary extends Component<
  ChatbotMarkdownErrorBoundaryProps,
  ChatbotMarkdownErrorBoundaryState
> {
  state: ChatbotMarkdownErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChatbotMarkdownErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logClientError('Chatbot Markdown renderer failed.', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
