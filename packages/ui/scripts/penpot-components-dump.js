function dumpPenpotComponents() {
  const sets = {};
  const seen = new Set();

  for (const component of penpot.library.local.components) {
    if (!component.isVariant() || !component.variants) {
      continue;
    }
    const variants = component.variants;
    if (seen.has(variants.id)) {
      continue;
    }
    seen.add(variants.id);
    const container = component.mainInstance().parent;
    if (!container?.isVariantContainer()) {
      throw new Error(`Missing variant container for ${component.name}`);
    }
    if (Object.hasOwn(sets, container.name)) {
      throw new Error(`Duplicate variant set ${container.name}`);
    }
    sets[container.name] = Object.fromEntries(
      variants.properties.map((property) => [
        property,
        [...new Set(variants.currentValues(property))].sort(),
      ]),
    );
  }

  return Object.fromEntries(
    Object.entries(sets).sort(([left], [right]) => left.localeCompare(right)),
  );
}
