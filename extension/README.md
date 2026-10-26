# FlytLese builds

Use Linux, Node.js 24, and pnpm 12.14.0. Run these commands from the source
archive's root to reproduce the production Firefox extension:

```bash
npm install --global pnpm@12.14.0
pnpm install --frozen-lockfile --filter '@flyt/extension...'
VITE_API_ORIGIN=https://api.flyt.umebocchi.my.id \
VITE_APP_ORIGIN=https://flyt.umebocchi.my.id \
pnpm --filter @flyt/extension build:firefox
pnpm --filter @flyt/extension lint:firefox
```

The unpacked extension is in `extension/dist/firefox`. Zip that directory's
contents with `manifest.json` at the archive root. The Chrome build uses the
same environment with `pnpm --filter @flyt/extension build` and writes to
`extension/dist/chrome`.

Both build scripts use Vite's production mode and load `.env.production` by
default. `build:firefox` sets `FLYT_BROWSER=firefox` to select the browser;
`FLYT_BROWSER` accepts only `chrome` and `firefox`.

Regenerate the committed 16, 32, 48, and 128 px browser icons from the Penpot mark
in `extension/assets/flytlese-mark.svg` with:

```bash
pnpm --filter @flyt/extension icons:generate
```

The script uses the pinned workspace Sharp dependency. Keep the SVG's tile fill
aligned with the shared `background-brand-bold` token; inline marks use the token
directly.

The source archive includes the extension, both shared packages, the workspace
manifests, the shared TypeScript configuration, the dependency lockfile, the pnpm
version guard, the MIT license, and `.gitignore`. Keep `.gitignore` in place so
Tailwind excludes previous build output when rebuilding both browsers. Installation
requires access to the npm registry. No credentials or running backend are
needed to build. Store publishing and account setup are documented in
`knowledge/operations/runtime.md` in the full repository.
