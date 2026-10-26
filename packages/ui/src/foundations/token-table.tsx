import type { ComponentType } from 'react';

import paletteStylesheet from '../styles/palette.css?raw';
import themeLightStylesheet from '../styles/theme-light.css?raw';
import tokenStylesheet from '../styles/tokens.css?raw';
import { Heading } from '../components/heading';
import { Text } from '../components/text';
import {
  ALL_TOKEN_DOCS,
  COMPONENT_TOKEN_PREFIXES,
  type TokenSection,
} from './token-docs';
import {
  findTokenDoc,
  readTokenSource,
  resolveToken,
  type SourceToken,
  type TokenDoc,
} from './token-source';

export type Specimen = ComponentType<{ token: string }>;

const SHARED_TOKENS = readTokenSource(
  [paletteStylesheet, themeLightStylesheet, tokenStylesheet].join('\n'),
);

function docLabel(doc: TokenDoc): string {
  return 'family' in doc ? `--${doc.family}-*` : doc.name;
}

function tokensOwnedBy(doc: TokenDoc): SourceToken[] {
  return SHARED_TOKENS.filter(
    (token) =>
      findTokenDoc(token.name, ALL_TOKEN_DOCS, COMPONENT_TOKEN_PREFIXES) ===
      doc,
  );
}

function aliasOf(source: string): string {
  const alias = /^var\((--[\w-]+)\)$/.exec(source);
  return alias ? alias[1] : source;
}

function SpecimenCell({
  Specimen,
  token,
}: {
  Specimen: Specimen | undefined;
  token: string;
}) {
  if (!Specimen) return <td />;
  return (
    <td className="w-14 py-2 pr-4 align-middle">
      <Specimen token={token} />
    </td>
  );
}

function TokenRow({
  token,
  Specimen,
}: {
  token: SourceToken;
  Specimen: Specimen | undefined;
}) {
  const resolved = resolveToken(token.name);
  return (
    <tr className="border-b border-default" data-token={token.name}>
      <SpecimenCell Specimen={Specimen} token={token.name} />
      <td className="w-56 whitespace-nowrap py-2 pr-4 align-middle">
        <Text as="code" font="mono" size="small">
          {token.name}
        </Text>
      </td>
      <td className="w-48 whitespace-nowrap py-2 pr-4 align-middle">
        <Text as="span" font="mono" size="small" tone="subtle">
          {aliasOf(token.source)}
        </Text>
      </td>
      <td
        className="whitespace-nowrap py-2 align-middle"
        data-resolved={resolved}
      >
        <Text as="span" font="mono" size="small" tone="subtle">
          {resolved}
        </Text>
      </td>
    </tr>
  );
}

function DocGroup({
  doc,
  Specimen,
}: {
  doc: TokenDoc;
  Specimen: Specimen | undefined;
}) {
  return (
    <div className="grid gap-1 pt-4">
      <p>
        <Text as="span" font="mono" size="medium" weight="semibold">
          {docLabel(doc)}
        </Text>{' '}
        <Text as="span" size="medium" tone="subtle">
          — {doc.useWhen}
        </Text>
      </p>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <tbody>
            {tokensOwnedBy(doc).map((token) => (
              <TokenRow key={token.name} Specimen={Specimen} token={token} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TokenSectionTable({
  section,
  Specimen,
}: {
  section: TokenSection;
  Specimen?: Specimen;
}) {
  return (
    <section className="grid gap-2">
      <Heading as="h2" size="small">
        {section.title}
      </Heading>
      {section.docs.map((doc) => (
        <DocGroup Specimen={Specimen} doc={doc} key={docLabel(doc)} />
      ))}
    </section>
  );
}
