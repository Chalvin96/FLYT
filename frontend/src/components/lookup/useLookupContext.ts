import { useContext } from 'react';

import { lookupContext, type LookupContextValue } from './LookupContext';

export function useLookupContext(): LookupContextValue {
  const context = useContext(lookupContext);
  if (!context) {
    throw new Error('useLookupContext must be used within LookupProvider');
  }
  return context;
}
