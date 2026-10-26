export type SourceToken = {
  name: string;
  source: string;
};

export type NamedTokenDoc = { name: string; useWhen: string };
export type PaletteDoc = { family: string; useWhen: string };
export type TokenDoc = NamedTokenDoc | PaletteDoc;

type Block = {
  header: string;
  body: string;
};

const DOCUMENTED_BLOCK_HEADERS = new Set([':root, :host', '@theme']);
const PALETTE_STEP = /^--([a-z]+)-(\d+)$/;

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function topLevelBlocks(css: string): Block[] {
  const blocks: Block[] = [];
  let depth = 0;
  let headerStart = 0;
  let bodyStart = 0;
  let header = '';

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    if (character === '{') {
      if (depth === 0) {
        header = collapseWhitespace(css.slice(headerStart, index));
        bodyStart = index + 1;
      }
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ header, body: css.slice(bodyStart, index) });
        headerStart = index + 1;
      }
    }
  }

  return blocks;
}

function declarations(body: string): SourceToken[] {
  return body
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.startsWith('--'))
    .map((declaration) => {
      const separator = declaration.indexOf(':');
      return {
        name: declaration.slice(0, separator).trim(),
        source: collapseWhitespace(declaration.slice(separator + 1)),
      };
    });
}

export function readTokenSource(css: string): SourceToken[] {
  return topLevelBlocks(withoutComments(css))
    .filter((block) => DOCUMENTED_BLOCK_HEADERS.has(block.header))
    .flatMap((block) => declarations(block.body));
}

function paletteFamily(name: string): string | undefined {
  return PALETTE_STEP.exec(name)?.[1];
}

function claims(doc: TokenDoc, name: string): boolean {
  if ('family' in doc) {
    return paletteFamily(name) === doc.family;
  }
  return name === doc.name || name.startsWith(`${doc.name}-`);
}

function specificity(doc: TokenDoc): number {
  return 'family' in doc ? Number.POSITIVE_INFINITY : doc.name.length;
}

export function findTokenDoc(
  name: string,
  docs: readonly TokenDoc[],
  componentPrefixes: readonly string[] = [],
): TokenDoc | undefined {
  if (componentPrefixes.some((prefix) => name.startsWith(prefix))) {
    return undefined;
  }
  return docs
    .filter((doc) => claims(doc, name))
    .sort((left, right) => specificity(right) - specificity(left))[0];
}

export function resolveToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
