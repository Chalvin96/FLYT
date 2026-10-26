import path from 'node:path';

import js from '@eslint/js';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

// One config for the whole workspace. `@flyt/ui`, `@flyt/lexicon` and the
// extension share the closed-component definitions and call sites the frontend
// rules exist to protect, so the rules cannot stop at `frontend/`.

// Tailwind preflight strips list-style, so Safari/VoiceOver drops list
// semantics from bare ul/ol. Require an explicit role.
const listSemantics = ['ul', 'ol'].map((tag) => ({
  selector: `JSXOpeningElement[name.name='${tag}']:not(:has(JSXAttribute[name.name='role']))`,
  message:
    'Add role="list" — Tailwind preflight removes list-style and Safari/VoiceOver then drops list semantics (use role="none" for purely presentational lists).',
}));

const rawButton = {
  selector: "JSXOpeningElement[name.name='button']",
  message:
    'Use Button (actions) or Chip (filters, suggestions) from @flyt/ui. A raw <button> is only for a control whose semantics are not an action or a chip; add its file to RAW_BUTTON_OWNERS with the reason.',
};

const inlineStyle = {
  selector: "JSXAttribute[name.name='style']",
  message:
    'A style attribute bypasses the vocabulary the classes compile from. Take a utility or a token; a file that genuinely needs the channel is named in STYLE_OWNERS with the reason.',
};

// Radix surfaces reached through a namespace: the name-matched closed-surface
// selector cannot see a member expression, so these get their own rule.
const rawDialogContent = {
  selector:
    "JSXOpeningElement[name.type='JSXMemberExpression'][name.object.name='DialogPrimitive'][name.property.name=/^(Content|Overlay)$/]",
  message:
    'Use DialogContent from @flyt/ui (variant, padding, overlayPresentation, mobileOnly, showClose). Rendering the Radix primitive directly re-creates the surface outside the design system; add the file to RAW_DIALOG_OWNERS with the reason if it genuinely cannot.',
};

// `item.className` in a data-driven story hands a value to a component; only a
// class matcher, or a class read on the way into one, is an assertion.
const classAssertionSelectors = [
  "CallExpression[callee.property.name='toHaveClass']",
  "CallExpression[callee.name='expect'] MemberExpression[property.name=/^(className|classList)$/]",
  "CallExpression[callee.object.name='expect'] MemberExpression[property.name=/^(className|classList)$/]",
  "CallExpression[callee.property.name='toHaveAttribute'] Literal[value='class']",
  "CallExpression[callee.property.name='getAttribute'] Literal[value='class']",
];

const classAssertions = classAssertionSelectors.map((selector) => ({
  selector,
  message:
    "Assert what the learner perceives, not the classes that paint it: `data-state`, the role, `aria-checked`/`aria-pressed`/`aria-expanded`, or the accessible name. A read of the attribute only re-spells the recipe; where nothing perceives the difference, delete the assertion; appearance is proven in the PR's before/after/diff triptych.",
}));

// The paths the config does not lint at all.
export const IGNORED_PATHS = [
  '**/dist',
  '**/node_modules',
  '**/storybook-static',
  '**/.storybook',
  'frontend/src/types/api.generated.ts',
  'frontend/src/routeTree.gen.ts',
  '.design-sync/**',
  'ds-bundle/**',
];

// Where the raw-element rules stand down: `@flyt/ui`'s own components, where
// telling Chip to use Chip is circular, and the story and test globs, where raw
// markup is the point. Both the components block and the raw-button owner block
// below select on this list, and the escape ratchet reads the same export.
export const RAW_ELEMENT_EXEMPT_GLOBS = [
  'packages/ui/src/components/**/*.tsx',
  'frontend/src/**/*.{test,spec,stories}.{ts,tsx}',
  'packages/**/src/**/*.{test,spec,stories}.{ts,tsx}',
  'extension/src/**/*.{test,spec}.{ts,tsx}',
];

export const RAW_DIALOG_OWNERS = [];

export const CLASS_ASSERTION_EXEMPT_PACKAGES = ['packages/ui'];

// The subjects no screenshot answers: a control's target box, which is
// transparent where the painted child is smaller, and the visually hidden live
// region or role marker that keeps one announcement from becoming two. jsdom
// paints neither, so the utility on the element under test is the subject. The
// list is ratcheted, so a new entry is a deliberate act rather than a quiet
// widening.
export const CLASS_ASSERTION_EXEMPT_TESTS = [
  // A control's 44px target box.
  'packages/lexicon/src/SearchBar.test.tsx',
  'frontend/src/pages/AccountPage/AccountPage.test.tsx',
  'frontend/src/pages/ReadingPage/StoryReaderPage.test.tsx',
  // The send control's target box, and the visually hidden live status.
  'frontend/src/components/chatbot/FlytChatbotPanel.test.tsx',
  // The 24px hit area around the progress segment's 8px visual.
  'frontend/src/pages/LessonDetailPage/components/LessonProgressBar.test.tsx',
  // The live region beside the visible banner, and the hidden role markers.
  'frontend/src/components/flashcard/FlashCardBuild/FlashCardBuild.test.tsx',
  'frontend/src/components/flashcard/FlashCardCategorize/FlashCardCategorize.test.tsx',
  'frontend/src/components/flashcard/LessonSurfaceRegression.test.tsx',
  'frontend/src/components/flashcard/OperationShell.test.tsx',
  'frontend/src/components/portable/BlockView.test.tsx',
];

export const CLOSED_COMPONENTS = [
  'Accordion',
  'AccordionContent',
  'AccordionItem',
  'AccordionTrigger',
  'AnswerOption',
  'AudioPlayButton',
  'Badge',
  'BaseHeroCard',
  'BottomSheetDialogContent',
  'Breadcrumb',
  'BreadcrumbItem',
  'BreadcrumbLink',
  'BreadcrumbList',
  'Button',
  'CandidateList',
  'Card',
  'CardContent',
  'CardDescription',
  'CardFooter',
  'CardHeader',
  'CardTitle',
  'Chip',
  'ChoiceTile',
  'DefinitionView',
  'DialogClose',
  'DialogContent',
  'DialogDescription',
  'DialogFooter',
  'DialogHeader',
  'DialogOverlay',
  'DialogTitle',
  'DialogTrigger',
  'ErrorMessage',
  'ExercisePrompt',
  'FlashCardFrame',
  'GenderBadge',
  'Glyph',
  'Heading',
  'IconWell',
  'Input',
  'InlineTrigger',
  'LemmaActionRow',
  'LemmaCardView',
  'LemmaHeader',
  'Modal',
  'OperationShell',
  'PopoverAnchor',
  'PopoverContent',
  'PopoverTrigger',
  'PronunciationRow',
  'RadioGroup',
  'RadioGroupItem',
  'Row',
  'SearchBar',
  'Separator',
  'Skeleton',
  'Table',
  'TableBody',
  'TableCaption',
  'TableCell',
  'TableFooter',
  'TableHead',
  'TableHeader',
  'TableRow',
  'Tabs',
  'TabsContent',
  'TabsList',
  'TabsTrigger',
  'Text',
  'Toaster',
  'TokenBoard',
  'TokenChip',
  'TooltipContent',
  'TooltipTrigger',
  'WordFormChip',
];

const closedSurface = ['className', 'style'].map((prop) => ({
  selector: `JSXOpeningElement:matches(${CLOSED_COMPONENTS.map(
    (name) => `[name.name='${name}']`,
  ).join(', ')}) > JSXAttribute[name.name='${prop}']`,
  message: `This component's surface is closed: pick a variant, or put ${prop} on your own wrapper element. Reaching past the type with a cast is not an approved escape.`,
}));

const APP_IMPORT_PATTERNS = [
  '@/*',
  '@/**',
  '**/frontend',
  '**/frontend/**',
  '**/extension',
  '**/extension/**',
];

// One assembly for every block that enforces the raw-element rules: each block
// only names what it stands down on, so a selector cannot go missing from one
// block while the others keep it.
const buildRawElementRestrictions = ({
  button = true,
  dialog = true,
  style = true,
} = {}) => [
  'error',
  ...listSemantics,
  ...(button ? [rawButton] : []),
  ...(dialog ? [rawDialogContent] : []),
  ...(style ? [inlineStyle] : []),
  ...closedSurface,
];

// Control families whose semantics are neither an action nor a chip.
export const RAW_BUTTON_OWNERS = [
  // Graded exercise inputs: roving focus, grading lifecycle, token selection.
  'frontend/src/components/flashcard/AnswerOption/AnswerOption.tsx',
  'frontend/src/components/flashcard/FlashCardFindFix/FlashCardFindFix.tsx',
  'frontend/src/components/flashcard/FlashCardMatch/FlashCardMatch.tsx',
  'frontend/src/components/flashcard/TokenChip/TokenChip.tsx',
  // Mobile-only prompt disclosures.
  'frontend/src/components/flashcard/OperationShellBody.tsx',
  'frontend/src/components/flashcard/FlashCardWrite/FlashCardWriteEditor.tsx',
  // Content-embedded lookup and disclosure triggers inside reading text.
  'frontend/src/components/portable/DialogueView.tsx',
  'frontend/src/components/portable/ReadingBlock.tsx',
  'frontend/src/components/reading/WordSpan.tsx',
  // Navigation chrome.
  'frontend/src/components/nav/AppShell.tsx',
  'frontend/src/components/router/AppNavbar/AppNavbar.tsx',
  'frontend/src/components/router/AppNavbar/SearchIconButton.tsx',
  'frontend/src/pages/LessonDetailPage/components/LessonProgressBar.tsx',
  // Newly linted with the config's move to the repository root; these were
  // never covered while `eslint .` ran only inside frontend/.
  // Disclosure triggers: inline text that expands, not a control's surface.
  'packages/lexicon/src/DefinitionExample.tsx',
  'packages/lexicon/src/DefinitionExamples.tsx',
  'packages/lexicon/src/NorwegianDefinition.tsx',
];

// Where the style channel stays open: a value a utility cannot interpolate, a
// property no utility exists for, or the deliberate discard that closes the
// channel after a props spread. The list is ratcheted, so a new entry is a
// deliberate act rather than a quiet widening.
export const STYLE_OWNERS = [
  // Progress and meter fills whose value is runtime state.
  'frontend/src/components/common/BaseHeroCard/BaseHeroCard.tsx',
  'frontend/src/pages/ReviewPage/DeckBrowseSection.tsx',
  'frontend/src/pages/LessonDetailPage/components/LessonLayout.tsx',
  'frontend/src/pages/LessonPage/LessonLevelSelector.tsx',
  'frontend/src/pages/HomePage/components/QueueDiagram.tsx',
  'frontend/src/pages/AccountPage/DeleteAccountModal.tsx',
  // A property with no utility: scroll anchoring on the message list.
  'frontend/src/components/chatbot/FlytChatbotConversationList.tsx',
  // The selection icon sits beside the reader's selection, a page coordinate.
  'extension/src/popup/overlayView.tsx',
  // A per-cell span the inflection data drives.
  'frontend/src/components/flashcard/InflectionTable/NounInflectionTable.tsx',
  // The flip's opacity and visibility ride on state, not on a class toggle.
  'frontend/src/components/flashcard/FlashCardDefinition/FlashCardDefinition.tsx',
  // The discard that closes the style channel after the props spread.
  'frontend/src/components/flashcard/TokenBoard/TokenBoard.tsx',
  'frontend/src/components/flashcard/FlashCardFrame.tsx',
  'frontend/src/components/flashcard/TokenChip/TokenChip.tsx',
  'packages/lexicon/src/DefinitionView.tsx',
  'packages/lexicon/src/LemmaHeader.tsx',
  'packages/lexicon/src/LemmaCardView.tsx',
];

const TAILWIND_SOURCES = {
  // The attribute name matches exactly, not as a pattern: `class|className`
  // matches nothing here, and a matcher that silently sees no class string is
  // indistinguishable from a clean file.
  selectors: [
    {
      kind: 'attribute',
      name: 'className',
      match: [{ type: 'strings' }],
    },
    {
      kind: 'attribute',
      name: 'class',
      match: [{ type: 'strings' }],
    },
    {
      kind: 'callee',
      name: 'cn|clsx|cva|twMerge',
      match: [
        { type: 'strings' },
        { type: 'objectValues', path: '^variants.*$' },
        {
          type: 'objectValues',
          path: '^compoundVariants\\[\\d+\\]\\.(?:className|class)$',
        },
      ],
    },
    // Keying on names let a renamed variable carry a forced utility through, and
    // the plain-string matcher alone misses array elements and object values.
    {
      kind: 'variable',
      name: '.*',
      match: [{ type: 'strings' }, { type: 'objectValues' }],
    },
  ],
};

const FORCED_UTILITY = {
  // A body is required after (or before) the marker: a bare `!` is
  // punctuation — a marker glyph, a punctuation set — not a forced
  // utility, and only a token is a candidate here.
  pattern: '^!.+|.+!$',
  message:
    'Do not force a utility with `!`. If the recipe is wrong, change the recipe or the token, not this call site.',
};

// What `Text` owns: a bare size, leading, weight, face or label tracking. A call
// site that types one of these re-assembles a recipe the primitive already
// carries, which is how 311 class strings grew out of a twelve-step scale.
// Alignment (`text-center`), decoration, colour and arbitrary display geometry
// stay out: they are laid out by the element that owns them, or bespoke by
// design.
export const TYPOGRAPHY_RESTRICTIONS = [
  {
    pattern: '(^|:)text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|prompt)(/[^ ]+)?$',
    message:
      'Text owns the type scale. Ask for it with size= (its leading comes with it) instead of a bare font size.',
  },
  {
    pattern:
      '(^|:)text-\\[(?!(?:var\\()?--(?!text-)|#|rgb|hsl|oklch|light-dark\\(|color:)[^\\]]+\\](/[^ ]+)?$',
    message:
      'Text owns the type scale. An arbitrary font size is off the scale; ask for a size= step instead.',
  },
  {
    pattern:
      '(^|:)leading-(none|tight|snug|normal|relaxed|loose|roomy|[3-9]|10)$',
    message:
      'A Text size carries its own leading, so a size and a leading can never be mismatched. Do not pick the leading here.',
  },
  {
    pattern: '(^|:)leading-\\[[^\\]]+\\]$',
    message:
      'A Text size carries its own leading, so a size and a leading can never be mismatched. An arbitrary leading is off the scale; ask for a size= step instead.',
  },
  {
    pattern:
      '(^|:)font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$',
    message:
      'Text owns the weight axis. Ask for it with weight= instead of a bare font weight.',
  },
  {
    pattern: '(^|:)font-(display|mono|serif)$',
    message:
      'Text owns the face axis. Ask for it with font="mono" or font="serif"; there is one body face.',
  },
  {
    pattern: '(^|:)font-\\[[^\\]]+\\]$',
    message:
      'Text owns the weight and face axes. An arbitrary font value is off the scale; ask for weight= or font= instead.',
  },
  {
    pattern: '(^|:)tracking-(label|\\[[^\\]]+\\])$',
    message:
      'The label tracking is part of role="eyebrow", which owns the whole label recipe; an arbitrary tracking is off the scale.',
  },
];

// Where the typography rule applies. The escape ratchet resolves the rule the
// config gives each of these globs and reads TYPOGRAPHY_LINT_GLOBS as a
// ratcheted list, so a glob leaves it only as an acknowledged narrowing.
export const TYPOGRAPHY_LINT_GLOBS = [
  'frontend/src/**/*.{ts,tsx}',
  'packages/*/src/**/*.{ts,tsx}',
  'extension/src/**/*.{ts,tsx}',
];

// Where a class string is the vocabulary rather than a call site: a recipe file
// assembles the very type Text exposes, and a story or test states the class it
// asserts. Naming a file here is the edit that has to be defended.
export const TYPOGRAPHY_OWNERS = [
  'packages/ui/src/components/text-variants.ts',
  // A control whose step is viewport-conditional and whose file-input
  // pseudo-element carries its own step: `text-base`/`md:text-sm` and
  // `file:text-sm`/`file:font-medium` are not a size the axis can name. The
  // control's height and padding own the vertical position, not a line box.
  'packages/ui/src/components/input-variants.ts',
  // The label recipe without `uppercase`, which would render the operation
  // name in capitals (knowledge/design-system/foundations.md).
  'frontend/src/components/flashcard/OperationShellBody.tsx',
  // The hero sentence's fluid display step is a continuous ramp, not a step
  // the scale can name.
  'frontend/src/pages/HomePage/components/LandingHero.tsx',
];

export const RAW_FORM_TYPE_VARIANT_OWNERS = [
  'frontend/src/components/chatbot/FlytChatbotComposer.tsx',
  'frontend/src/components/flashcard/FlashCardWrite/FlashCardWriteEditor.tsx',
  'frontend/src/components/lookup/LookupSheet.tsx',
  'frontend/src/components/reading/ImportTextSheet.tsx',
  'frontend/src/pages/ReadingPage/ReadingImportsPage.tsx',
  'frontend/src/pages/WordsPage/WordsPage.tsx',
];

export default tseslint.config(
  {
    ignores: IGNORED_PATHS,
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@flyt/ui/src/**',
                '@flyt/lexicon/src/**',
                '**/packages/ui/src/**',
                '**/packages/lexicon/src/**',
                '**/*-variants',
                '**/*-variants.ts',
              ],
              message:
                'Import from @flyt/ui or @flyt/lexicon. The recipes behind a component are private: reaching past the entrypoint replays the design system on a raw element, which is the escape the closed surfaces exist to prevent.',
            },
          ],
        },
      ],
      // A leading underscore means "destructured to be excluded".
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-restricted-syntax': [
        ...buildRawElementRestrictions(),
        ...classAssertions,
      ],
    },
  },
  {
    // Inside a package its own recipes are the implementation, not something
    // reached past the entrypoint. The cross-package ban still holds.
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@flyt/ui/src/**',
                '@flyt/lexicon/src/**',
                '**/packages/ui/src/**',
                '**/packages/lexicon/src/**',
              ],
              message:
                'Import from @flyt/ui or @flyt/lexicon. Reaching into another package past its entrypoint replays the design system on a raw element.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/ui/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@flyt/lexicon',
                '@flyt/lexicon/**',
                ...APP_IMPORT_PATTERNS,
              ],
              message:
                'packages/ui is the design system and must not import domain or app code.',
            },
            {
              group: [
                '@flyt/ui/src/**',
                '**/packages/ui/src/**',
                '**/packages/lexicon/src/**',
              ],
              message:
                'Import from @flyt/ui or @flyt/lexicon. Reaching into another package past its entrypoint replays the design system on a raw element.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/lexicon/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: APP_IMPORT_PATTERNS,
              message:
                'packages/lexicon is shared domain UI and must not import app code.',
            },
            {
              group: [
                '@flyt/ui/src/**',
                '@flyt/lexicon/src/**',
                '**/packages/ui/src/**',
                '**/packages/lexicon/src/**',
              ],
              message:
                'Import from @flyt/ui or @flyt/lexicon. Reaching into another package past its entrypoint replays the design system on a raw element.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}', 'extension/src/**/*.{ts,tsx}'],
    ignores: ['**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@flyt/ui/src/**',
                '@flyt/lexicon/src/**',
                '**/packages/ui/src/**',
                '**/packages/lexicon/src/**',
                '**/*-variants',
                '**/*-variants.ts',
              ],
              message:
                'Import from @flyt/ui or @flyt/lexicon. The recipes behind a component are private: reaching past the entrypoint replays the design system on a raw element, which is the escape the closed surfaces exist to prevent.',
            },
          ],
          paths: [
            {
              name: '@flyt/ui',
              importNames: ['textVariants', 'headingVariants'],
              message: 'Use Text or Heading for application typography.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/src/**/*.stories.tsx', 'extension/src/**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@flyt/ui/src/**',
                '@flyt/lexicon/src/**',
                '**/packages/ui/src/**',
                '**/packages/lexicon/src/**',
                '**/*-variants',
                '**/*-variants.ts',
              ],
              message:
                'Import from @flyt/ui or @flyt/lexicon. The recipes behind a component are private: reaching past the entrypoint replays the design system on a raw element, which is the escape the closed surfaces exist to prevent.',
            },
          ],
        },
      ],
    },
  },
  {
    files: RAW_FORM_TYPE_VARIANT_OWNERS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@flyt/ui/src/**',
                '@flyt/lexicon/src/**',
                '**/packages/ui/src/**',
                '**/packages/lexicon/src/**',
                '**/*-variants',
                '**/*-variants.ts',
              ],
              message:
                'Import from @flyt/ui or @flyt/lexicon. The recipes behind a component are private: reaching past the entrypoint replays the design system on a raw element, which is the escape the closed surfaces exist to prevent.',
            },
          ],
          paths: [
            {
              name: '@flyt/ui',
              importNames: ['headingVariants'],
              message: 'Use Heading for application typography.',
            },
          ],
        },
      ],
    },
  },
  {
    // `use` here is Playwright's fixture callback, not a React hook.
    files: ['extension/e2e/**/*.ts', 'frontend/e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
    },
  },
  ...(RAW_DIALOG_OWNERS.length === 0
    ? []
    : [
        {
          files: RAW_DIALOG_OWNERS,
          rules: {
            'no-restricted-syntax': buildRawElementRestrictions({
              dialog: false,
            }),
          },
        },
      ]),
  {
    files: STYLE_OWNERS,
    rules: {
      'no-restricted-syntax': buildRawElementRestrictions({ style: false }),
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'better-tailwindcss': betterTailwind },
    settings: {
      'better-tailwindcss': {
        // Tailwind lives in the frontend workspace; entryPoint is resolved
        // relative to `cwd`, so it is spelled from `frontend/`.
        cwd: path.join(import.meta.dirname, 'frontend'),
        entryPoint: 'src/index.css',
      },
    },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          ...TAILWIND_SOURCES,
          restrict: [FORCED_UTILITY],
        },
      ],
      'better-tailwindcss/no-conflicting-classes': ['error', TAILWIND_SOURCES],
      'better-tailwindcss/no-deprecated-classes': ['error', TAILWIND_SOURCES],
    },
  },
  {
    // The type vocabulary is closed where the scale is consumed. A recipe file
    // that assembles the vocabulary itself, or a story that asserts a class, is
    // named in TYPOGRAPHY_OWNERS instead; the escape ratchet makes naming it
    // the edit that has to be defended.
    files: TYPOGRAPHY_LINT_GLOBS,
    ignores: TYPOGRAPHY_OWNERS,
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          ...TAILWIND_SOURCES,
          restrict: [FORCED_UTILITY, ...TYPOGRAPHY_RESTRICTIONS],
        },
      ],
    },
  },
  ...(TYPOGRAPHY_OWNERS.length === 0
    ? []
    : [
        {
          files: TYPOGRAPHY_OWNERS,
          rules: {
            // Every other tailwind rule still applies; only the type
            // vocabulary stands down here, and the forced-utility ban does
            // not.
            'better-tailwindcss/no-restricted-classes': [
              'error',
              { ...TAILWIND_SOURCES, restrict: [FORCED_UTILITY] },
            ],
          },
        },
      ]),
  {
    // A class only the app stylesheet defines drops silently in the extension,
    // so shared source answers to the surface `@flyt/ui` owns. The glob must
    // reach `.ts`, where `*-variants.ts` carries the recipes.
    files: ['packages/*/src/**/*.{ts,tsx}'],
    ignores: ['packages/*/src/**/*.{test,spec}.{ts,tsx}'],
    plugins: { 'better-tailwindcss': betterTailwind },
    settings: {
      'better-tailwindcss': {
        // `@flyt/ui` owns the entry point and the Tailwind install it is
        // resolved against, so the shared surface does not depend on an app
        // workspace.
        cwd: path.join(import.meta.dirname, 'packages/ui'),
        entryPoint: 'src/styles/entry.css',
      },
    },
    rules: {
      // The plugin's own class sources, not TAILWIND_SOURCES: this rule reads
      // every string it matches as a class list, and the wide `variables`
      // matcher would read the packages' prose, labels and testids as unknown
      // classes. The defaults read class strings where shared recipes put
      // them — `className`/`class`, the cn/cva/clsx/twMerge calls, and the
      // variant values inside a cva call.
      'better-tailwindcss/no-unknown-classes': [
        'error',
        {
          // Sonner's own marker for the `group-[.toaster]:` variants the
          // Toaster recipe passes through: a marker the recipe needs on the
          // element, with no stylesheet rule of its own to register.
          ignore: ['^toaster$'],
        },
      ],
    },
  },
  {
    // A raw button's file keeps the style channel closed, like every other
    // non-owner surface.
    files: RAW_BUTTON_OWNERS,
    rules: {
      'no-restricted-syntax': buildRawElementRestrictions({
        button: false,
        dialog: false,
      }),
    },
  },
  {
    // Telling @flyt/ui's own components to use @flyt/ui is circular: Chip must
    // render a `<button>` and DialogContent the Radix primitive. They are held
    // closed instead. Everything outside these globs still answers to both.
    files: RAW_ELEMENT_EXEMPT_GLOBS,
    rules: {
      'no-restricted-syntax': buildRawElementRestrictions({
        button: false,
        dialog: false,
        style: false,
      }),
    },
  },
  {
    files: STYLE_OWNERS.filter((file) => RAW_BUTTON_OWNERS.includes(file)),
    rules: {
      'no-restricted-syntax': buildRawElementRestrictions({
        button: false,
        dialog: false,
        style: false,
      }),
    },
  },
  ...(RAW_DIALOG_OWNERS.length === 0
    ? []
    : [
        {
          files: STYLE_OWNERS.filter((file) =>
            RAW_DIALOG_OWNERS.includes(file),
          ),
          rules: {
            'no-restricted-syntax': buildRawElementRestrictions({
              dialog: false,
              style: false,
            }),
          },
        },
      ]),
  {
    files: RAW_ELEMENT_EXEMPT_GLOBS,
    ignores: CLASS_ASSERTION_EXEMPT_PACKAGES.map(
      (packagePath) => `${packagePath}/**`,
    ),
    rules: {
      'no-restricted-syntax': [
        'error',
        ...listSemantics,
        ...classAssertions,
        ...closedSurface,
      ],
    },
  },
  {
    files: CLASS_ASSERTION_EXEMPT_TESTS,
    rules: {
      'no-restricted-syntax': ['error', ...listSemantics, ...closedSurface],
    },
  },
  {
    files: ['frontend/src/_*.tsx', 'frontend/src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['**/.storybook/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['frontend/src/**/*.{test,spec}.{ts,tsx}'],
    extends: [testingLibrary.configs['flat/react']],
    rules: {
      'testing-library/no-container': 'error',
      'testing-library/no-node-access': 'error',
    },
  },
);
