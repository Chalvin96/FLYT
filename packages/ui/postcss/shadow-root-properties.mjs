import postcss from 'postcss';

const TW_PROPERTY = /^--tw-[\w-]+$/;
const PROPERTY_SCOPE = ':host, *, ::before, ::after, ::backdrop';

function shadowRootProperties() {
  return {
    postcssPlugin: 'shadow-root-properties',
    OnceExit(root) {
      const restated = [];
      root.walkAtRules('property', (registration) => {
        if (!TW_PROPERTY.test(registration.params.trim())) return;
        const initial = registration.nodes?.find(
          (node) => node.type === 'decl' && node.prop === 'initial-value',
        );
        restated.push(
          postcss.decl({
            prop: registration.params.trim(),
            value: initial ? initial.value : 'initial',
          }),
        );
        registration.remove();
      });
      if (restated.length === 0) return;
      root.append(
        postcss.atRule({
          name: 'layer',
          params: 'properties',
          nodes: [postcss.rule({ selector: PROPERTY_SCOPE, nodes: restated })],
        }),
      );
    },
  };
}

shadowRootProperties.postcss = true;

export default shadowRootProperties;
