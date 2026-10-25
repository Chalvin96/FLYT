# Components and interaction

@flyt/ui owns reusable controls and their typed appearance. Pages own composition,
layout, and domain behavior. Shared controls stay domain-neutral.

Give controls named variants for meaningful differences instead of allowing callers to
restyle their internals. Keep page geometry on page elements. Preserve accessible names,
keyboard access, visible focus, and focus return when an overlay closes. Respect
reduced-motion preferences.

A learner's state never rests on colour alone. Pair state colour with text, a shape, or
an icon that communicates the same meaning. Selection is not a verdict; selected,
correct, and incorrect remain distinct states. A transition is announced once; do not
announce it through both visible status and a second live region. Loading skeletons are
not interactive controls.

Disabled controls use neutral grey tokens, never a brand tint. An unavailable choice
remains keyboard reachable so its reason can be read, but moving focus onto it does not
select it. The group owns radio semantics, the roving tab stop, and arrow-key movement.

Tests outside @flyt/ui assert accessible output or semantic state, such as a role,
accessible name, data-state, aria-checked, or aria-pressed. They do not assert
implementation classes.

The @flyt/ui package owns domain-neutral primitives. @flyt/lexicon owns dictionary
components shared by the app and extension; surface-specific features stay with that
surface. Shared packages never import app code.

Closed controls expose typed variants instead of caller className or style overrides.
Lint and the escape ratchet guard that boundary. Add a variant only when a real caller
needs it.

Button gives SVGs a default 16 px size. SVGs with an explicit size utility keep
that geometry, so a brand mark can retain its dimensions inside an icon button.

Name appearance props by their role: tone for color or severity, layout for geometry,
and presentation for rendering context.

Inline reader-word controls stay within the prose line box because a taller invisible
target would distort neighboring lines. Keep native button semantics, visible focus,
and an underline cue for learner state.

Text owns the type scale. A size carries its line height so callers cannot combine an
unrelated size and leading. Shared type tokens live in the UI stylesheet because the
extension does not load the app stylesheet.

Glyph is decorative and hidden from assistive technology by default. Give meaning to the
surrounding control or text, not to a decorative mark alone.
