export const K_LEXICON_API_BASE_PATH = '/lexicons' as const;

export const K_LEXICON_API_PATH = {
  SUGGESTIONS: `${K_LEXICON_API_BASE_PATH}/suggestions`,
  BROWSE: `${K_LEXICON_API_BASE_PATH}/browse`,
  LEMMAS: `${K_LEXICON_API_BASE_PATH}/lemmas`,
  DEFINITIONS: `${K_LEXICON_API_BASE_PATH}/definitions`,
  MY_LEMMAS: '/me/lemmas',
} as const;

export const K_LEXICON_QUERY_PARAM = {
  SEARCH_QUERY: 'query',
  BROWSE_QUERY: 'q',
} as const;

export const K_LEXICON_SUGGEST_QUERY_MIN_LENGTH = 2 as const;
export const K_LEXICON_BROWSE_QUERY_MIN_LENGTH = 2 as const;
