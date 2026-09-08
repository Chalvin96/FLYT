import { createElement, lazy } from 'react';
import type { ComponentProps } from 'react';

const loadMarkdown = async () => {
  const [{ default: Markdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);

  return {
    default: (props: ComponentProps<typeof Markdown>) =>
      createElement(Markdown, { ...props, remarkPlugins: [remarkGfm] }),
  };
};

export const LazyMarkdown = lazy(loadMarkdown);

export function warmMarkdown() {
  void loadMarkdown().catch(() => undefined);
}
