# Browser extension

Chrome and Firefox share the extension source and the version in
`extension/package.json`. The default build writes Chrome to `dist/chrome`;
`build:firefox` writes Firefox to `dist/firefox`. CRXJS targets each browser.
`FLYT_BROWSER` selects `chrome` or `firefox` independently of Vite's mode;
other values fail the build. Both build scripts use production mode and load
`extension/.env.production` for the production API and app origins by default.
The Firefox manifest supplies `background.scripts` because the CRXJS 3 Firefox
loader expects that input; Chrome uses `background.service_worker`.
Firefox lint uses `web-ext` 10.8.0 with `multimatch` 8 so its named import is
compatible with the workspace's `minimatch` 10 override.

Firefox requires version 142 or later and uses the Gecko ID
`flytlese@flyt.umebocchi.my.id`. Its required data permissions follow
[Mozilla's taxonomy](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/):
`authenticationInfo` for the session token, `browsingActivity` for an imported
page's URL, `searchTerms` for dictionary queries, and `websiteContent` for selected
text, page titles, and imported page content.

The background entry is stateless. It reads the host cookie at invocation time and
forwards Bearer authentication for authenticated requests; the backend gives a supplied
Bearer token precedence. Anonymous dictionary resolution and search remain
unauthenticated.

The API host permission is scoped to the configured API origin. Firefox MV3
users can revoke host permissions, so the background checks `permissions.contains`
before reading the cookie or dispatching content requests to the API. Missing
access returns a distinct `permission` error without reading the cookie or
calling the API. The content popup tells the user to click the FlytLese toolbar
button to allow access to Flyt. Toolbar and context-menu handlers start
`permissions.contains` and then `permissions.request` before awaiting either
result, then forward the content command only when access is granted. A click
that newly grants access skips import commands but still runs lookup and
translation commands. Already granted access resolves silently;
a denied or failed request does nothing, because signing in cannot restore the
permission. Content-script messages never request permissions because
[Firefox does not treat them as user gestures](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions).

`sendTabCommand` resolves to a `delivered` outcome indicating whether the content script received the command;
delivery failures resolve to `{ delivered: false }` so fire-and-forget callers remain safe.
After a failed delivery from a toolbar or context-menu gesture, the background
checks `<all_urls>`. If website access is missing, it opens the site access
page with `runtime.openOptionsPage`. With website access granted, a missing
receiver needs no action because browser-internal and store pages cannot run
content scripts.

Both browser manifests declare the site access page through `options_ui` with
`open_in_tab: true`. Its Allow button requests `<all_urls>` and the configured
API origin directly from the click handler on the extension page. After a grant,
the page asks the user to reload the page they were reading. The page explains
that Flyt receives dictionary searches and selected text for lookups and
translations, sentence and title context when saving a word, URL, title, and
readable text when importing a page, and the session token for account actions.
It uses the extension's existing Tailwind entry with the shared UI stylesheet.

The content popup renders inside a closed shadow root with its own shared UI stylesheet.
This isolates its controls from arbitrary host-page styles, so shared recipes must get
their styles from the UI package. The extension does not fetch web fonts on every page
it visits.

The popup uses a non-modal popover with a virtual selection anchor, so it owns focus
movement, trapping, and restoration. Escape and outside-pointer interaction close it.
Restoring focus matters because the virtual anchor cannot act as a normal trigger. The
named dialog does not claim `aria-modal` because the popup is non-modal.
Opening focuses the dialog panel, which has `tabIndex=-1`, so a mouse lookup does
not put a focus ring on the close button. Tab and Shift-Tab stay inside the
existing focus trap; entering search focuses its input.

The popup shares one FlytLese mark between the header and selection lookup button.
Inline paths use `background-brand-bold` and `text-inverse`. The source SVG also
generates the browser icon PNGs. The mark keeps its 28 px geometry inside icon
controls, whose generic SVG sizing targets lucide icons. Popup controls and
typography use existing `@flyt/ui` recipes and tokens; the extension owns its
dictionary composition.
The first sense is visible initially, additional meanings expand on request, and
other homographs start collapsed. Word actions have equal widths below a
separator. The header, word actions, and page strip remain outside the scrolling
body. Search and page import are available for dictionary results, translations,
search, and loading; sign-in, access-needed, and failed requests omit them.

Selected text uses running word buttons with a dotted underline on hover or focus.
Only the selected occurrence is highlighted. Source and translation independently
clamp to three lines and expand with Show all / Show less. Focusing a word outside
the source clamp automatically reveals it. Translation requests
are limited to 2,000 Unicode code points. Longer selections use the last complete
sentence boundary within the limit, segmented with `Intl.Segmenter` for Norwegian.
When the first sentence alone exceeds the limit, the prefix ends at the last
word boundary only if it retains more than half of the 2,000 code point cap.
Otherwise it cuts at 2,000 code points without splitting a Unicode code point.
The cap trims the selection before counting or segmenting it. The popup shows
the translated prefix and explains how many selected sentences it translated,
or says "Translated the first part of the selection." for a partial sentence.
It omits the notice when the entire trimmed selection fits.
Import page remains the route to reading the whole page.
The full selected text reaches this cap before sentence context is bounded for
saving a word. A word lookup that finds no candidates after retry opens the
same translate view as an initial lookup with no candidates. It retains the
sentence context and translation across subsequent word lookups.

Selection translation follows Google Translate's handling of invalid input.
The context menu always opens the translate view for a nonempty selection that
cannot be translated, including a single code point, numbers, or punctuation.
Selections with fewer than two code points or no letters echo the selected text
as the translation without an API request. Translation responses classified as
too-large or invalid-page also echo the submitted source, including an
untranslatable URL. These outcomes show no error or retry action. Longer text
still uses the honest prefix cap and notice above.

Error kinds determine recovery actions. Network failures retry the same request;
unknown or server failures also offer Open Flyt. Quota failures offer only Open
Flyt and preserve the backend's user-facing message. Diagnostic exception text
never becomes popup copy. Translation failures retain the selected running text
and use the same error actions, except for the input outcomes above.
Page import failures classified as too-large or invalid-page cannot be retried
through the error actions. They retain Open Flyt and show the backend's
user-facing message, with existing fallback copy when it supplies none.
Only the small error icon uses danger colour.
Page import status survives lookup transitions within a popup session; responses
from an earlier session cannot overwrite a newer session's status.

Toast handles carry a generation number. A stale dismiss from an earlier import cannot
remove a newer toast.
