import shadowCss from '../../tailwind/index.css?inline';

export { shadowCss };

export const shadowMode = (): ShadowRootMode =>
  import.meta.env.VITE_E2E_HOOKS === 'true' ? 'open' : 'closed';
