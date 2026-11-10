# @devopsnext/starterkit-intro

[![CI](https://github.com/thinktalentservice-ai/starterkit-intro/actions/workflows/ci.yml/badge.svg)](https://github.com/thinktalentservice-ai/starterkit-intro/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@devopsnext/starterkit-intro)](./LICENSE)

A guided intro ("product tour") for any React app, driven by one small JSON file
per page. Router-agnostic, no runtime dependencies, its own positioning engine.

- **JSON, not code.** `public/intro/design/badge.json` is the intro for
  `/design/badge`. Writers edit text; nobody redeploys a component.
- **Per page, remembered.** Each page tours itself once per `revision`. Bump the
  revision and everyone sees it again.
- **A CLI that never overwrites a person.** `starterkit-intro capture` scaffolds
  files from `data-intro="…"` markers and merges later runs without touching
  anything that was written by hand.
- **Peers: `react` and `react-dom` (>=18) only.** No MUI, no Next, no
  floating-ui. ESM and CommonJS, with types for both.

```tsx
<IntroProvider pathname={pathname} baseUrl="/intro">
  <IntroHelpButton />
  <App />
</IntroProvider>
```

## Install

```bash
pnpm add --save-exact @devopsnext/starterkit-intro
```

Pin it exactly. A minor bump changes how the tour looks and behaves on every
route; a caret range would ship that silently.

Import the stylesheet once, anywhere that loads on every page:

```ts
import "@devopsnext/starterkit-intro/styles.css";
```

The package has `"sideEffects": ["*.css"]`, so bundlers keep that import.

### Trying a local checkout

Use a packed tarball, never `link:`. A linked package resolves its own `react`
from its own `node_modules`, which gives the host two Reacts and an
`Invalid hook call`; a tarball installs exactly what would ship.

```bash
cd ../starterkit-intro && pnpm build && pnpm pack      # devopsnext-starterkit-intro-0.1.0.tgz
cd ../my-app && pnpm add ../starterkit-intro/devopsnext-starterkit-intro-0.1.0.tgz
```

## Quick start

The provider needs two things from you: the **current pathname** and **where the
JSON files are served**. It does not know about any router.

### Next.js (App Router, with a `basePath`)

`usePathname()` returns the path **without** the `basePath`, which is what the
file naming rule wants. The files, however, are fetched from the real URL, so the
base path goes into `baseUrl`.

```tsx
// src/components/IntroShell.tsx
"use client";

import { usePathname } from "next/navigation";
import { IntroProvider } from "@devopsnext/starterkit-intro";
import "@devopsnext/starterkit-intro/styles.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function IntroShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <IntroProvider pathname={pathname} baseUrl={`${BASE_PATH}/intro`}>
      {children}
    </IntroProvider>
  );
}
```

Put it in a layout, then drop the buttons wherever your header has room:

```tsx
import { IntroAutoStartSwitch, IntroHelpButton } from "@devopsnext/starterkit-intro";

<IntroHelpButton />        {/* disabled on pages with no intro file */}
<IntroAutoStartSwitch />   {/* "Show intro on new pages" */}
```

Files live in `public/intro/` (served at `<basePath>/intro/…`). With
`output: "export"` they are copied into `out/` like any other static asset.

### React Router / Vite

```tsx
import { useLocation } from "react-router-dom";
import { IntroProvider } from "@devopsnext/starterkit-intro";
import "@devopsnext/starterkit-intro/styles.css";

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <IntroProvider pathname={pathname} baseUrl={`${import.meta.env.BASE_URL}intro`}>
      {children}
    </IntroProvider>
  );
}
```

`BASE_URL` already ends in a slash; a trailing slash on `baseUrl` is tolerated.
If your router has its own basename, pass the pathname **without** it.

### Provider props

| Prop | Type | Default | |
|---|---|---|---|
| `pathname` | `string` | required | Current route. Query and hash are ignored. |
| `baseUrl` | `string` | required | Where the JSON lives, e.g. `"/starterkit-user/intro"`. |
| `autoStart` | `boolean` | `true` | Start a page's tour by itself the first time a visitor sees a revision. |
| `autoStartDelay` | `number` | `700` | Ms after the document loads. Cancelled on route change and unmount. |
| `storageKey` | `string` | `"starterkit-intro"` | localStorage key. |
| `fetchIntro` | `(url, signal) => Promise<unknown>` | built-in | Return parsed JSON, or `null` for "no intro". Throw for a failure. |
| `onEvent` | `(e) => void` | | `loaded`, `start`, `step`, `complete`, `skip`, `missing-target`; each carries `route`, and `stepId` / `index` where relevant. |
| `labels` | `Partial<IntroLabels>` | | `next`, `back`, `done`, `skip`, `stepOf` (`"Step {n} of {total}"`), `close`. |

The built-in fetch is `fetch(url, { cache: "no-cache", credentials: "same-origin", signal })`.
A **404 means "this page has no intro"** and is silent; any other non-OK status is
a fault and logs one `console.warn`.

### `useIntro()`

```ts
const { hasIntro, isRunning, route, doc, start, stop, autoStartEnabled, setAutoStartEnabled } = useIntro();
```

`doc` is the loaded document with draft steps already removed. `stop()` closes the
tour **without** recording it as seen; finishing, skipping, pressing Esc or the
close button records it. Outside an `<IntroProvider>` it throws a clear error.

## Marking up the page

Anything with a CSS selector can be a target, but `data-intro` keeps selectors
stable and is what the CLI looks for:

```html
<section data-intro="pricing" data-intro-title="Pricing">…</section>
```

Target selectors should be class, id or attribute selectors. Position-based ones
(`:nth-child`) point at something else after the next edit.

## JSON reference

```json
{
  "schema": 1,
  "route": "/design/badge",
  "revision": 1,
  "title": "Badges",
  "steps": [
    { "id": "welcome", "title": "Welcome", "body": "A quick look around." },
    {
      "id": "variants",
      "target": "[data-intro=\"variants\"]",
      "title": "Variants",
      "body": "Pick a tone and a fill.",
      "placement": "bottom"
    }
  ]
}
```

| Field | Rules |
|---|---|
| `schema` | Must be `1`. |
| `route` | Normalised pathname the file belongs to. Must equal what the page's pathname normalises to, or the file is ignored with a warning. |
| `revision` | Positive integer. Bump it to show the tour again to people who finished it. |
| `title` | Optional, 1-80 characters. |
| `steps` | 1 to 30 steps. |
| `steps[].id` | `[a-z0-9][a-z0-9-]{0,63}`, unique within the file. |
| `steps[].target` | Optional CSS selector, 1-200 characters. **Omit for a centred step** with no spotlight. |
| `steps[].title` | 1-80 characters, not blank. |
| `steps[].body` | At most 400 characters. **Plain text** (rendered as text, never as HTML). Must not be empty unless the step is a `draft`. |
| `steps[].placement` | `auto` (default), `top`, `bottom`, `left`, `right`. A side with no room flips to the opposite one, then to whichever fits. |
| `steps[].optional` | A missing target is skipped without a warning. |
| `steps[].draft` | Not shown to visitors. See below. |
| `steps[].stale` | Set by the CLI. See below. |

**Unknown keys are errors**, at both levels (except an optional top-level `$schema` string, which editors can use; none is shipped yet), so a
typo like `"placment"` is caught instead of silently ignored. Validation collects
every problem with its path (`steps[2].title: …`).

`@devopsnext/starterkit-intro/schema` is a pure module (no React, no DOM) you can
use in a build gate or script:

```js
import { validateIntro, normalizeRoute, routeToIntroPath } from "@devopsnext/starterkit-intro/schema";

const result = validateIntro(JSON.parse(text));
if (!result.ok) throw new Error(result.errors.join("\n"));
```

### File naming

`routeToIntroPath(pathname)` decides where a page's file lives, relative to
`baseUrl`:

| Pathname | File |
|---|---|
| `/` | `index.json` |
| `/design/badge` or `/design/badge/` | `design/badge.json` |
| `/design/badge?tab=2#top` | `design/badge.json` |

Pathnames are normalised first (query and hash dropped, repeated slashes
collapsed, trailing slash dropped). Segments may contain only
`A-Z a-z 0-9 . _ ~ -`; `.` / `..`, `%`, backslashes and the literal route
`/index` (it would collide with the root's file) are refused, and those pages
simply have no intro.

### Draft and stale

- **`draft: true`**: the step is written but not reviewed. Drafts are filtered
  out at load time; a page whose steps are all drafts has no intro, and an empty
  `body` is legal only on drafts. Remove the flag when the text is ready.
- **`stale: true`**: set by `capture` when a step's target is no longer on the
  page. The step is **never deleted**: a person decides whether to retarget or
  remove it. Stale steps are still tried at runtime and skipped if the target is
  really gone. The flag clears itself on the next capture that finds the target.

### Runtime behaviour worth knowing

- A step whose target is missing, zero-sized or hidden (`display:none`,
  `visibility:hidden`) is skipped, with a `missing-target` event and a
  `console.warn` unless the step is `optional`. An invalid selector is skipped
  and warned about regardless. The step count (`Step n of m`) counts only what
  can be shown.
- A tour where **nothing** could be shown is not recorded as seen, so it tries
  again next visit (the targets may simply not have rendered yet).
- A bad file never breaks the host: a failed fetch, invalid JSON or a route
  mismatch logs one `console.warn` per URL and the page has no intro.
- The page behind a running tour is blocked from pointer interaction. Clicking
  the shade does nothing; an accidental click must not end the tour.

## CLI

```bash
pnpm add -D playwright && pnpm exec playwright install chromium   # the host's own Playwright
pnpm exec starterkit-intro list    --next-app src/app
pnpm exec starterkit-intro capture --next-app src/app
```

| Flag | |
|---|---|
| `--url <url>` | Page to capture; repeatable. Route = the URL's pathname minus the base path. |
| `--next-app <dir>` | Derive routes from `page.{js,jsx,ts,tsx}` under this directory. `(groups)` and `@slots` are dropped; `[dynamic]` routes are skipped and listed by name. |
| `--route <r>` | Only these routes; repeatable. |
| `--exclude <prefix>` | Drop this route and everything under it (segment-aware: `/login` drops `/login/user`, not `/loginx`); repeatable. An exclude that matches nothing is an error — a typo would otherwise capture the pages it meant to keep out. |
| `--origin <url>` | Dev server for `--next-app` (default `$INTRO_ORIGIN` or `http://localhost:3000`). |
| `--base-path <p>` | Default: `$NEXT_PUBLIC_BASE_PATH`, then `.env.local`, `.env.development`, `.env`. |
| `--out <dir>` | Default `public/intro`. |
| `--storage-state <file>` | Playwright storage state, for pages behind a login. |
| `--wait <ms>` | Default `1500`. |
| `--viewport WxH` | Default `1440x900`. |
| `--landmarks <csv>` | Layout selectors proposed as optional steps. Default `.il-topbar,.il-sidebar`. |
| `--no-landmarks` | Propose no landmark steps. Landmark steps already in a file are kept and still checked for staleness. Use it when only one or two pages should explain the shell. |
| `--color-scheme` | `light`, `dark` or `no-preference`. |

`list` prints `route -> url -> output file` for every route and opens no
browser. `capture` checks the dev server is listening first, then visits each
route and, per page:

1. collects the page's `<h1>`, every visible `[data-intro]` element in DOM order
   and which landmarks are visible;
2. **creates** `<out>/<route>.json` with a draft `welcome` step plus one draft step
   per element (`id` = the key, `target` = `[data-intro="key"]`, title from
   `data-intro-title`, `aria-label`, the first heading inside, or the text), and
   each visible landmark as a draft **optional** step; or
3. **merges** into the existing file: steps are matched by `id` (or by identical
   target) and keep every field a person edited, including order; new elements are
   appended as drafts; steps whose target has vanished get `stale: true`.
   `revision` is never changed.

The result is validated before it is written; an existing file that does not
validate is reported and left alone. A route that redirects (usually to a login
page) is a failure that tells you to pass `--storage-state`. The exit code is 1
if any route failed or nothing was written.

The CLI never emits position-based selectors, and refuses them in `--landmarks`.

## Theming

Everything is read from your design tokens, with the think preset's dark values
vendored as fallbacks, so an app with no tokens still gets a legible dark tour.
`styles.css` aliases each host token as `--ii-t-*` on `.ii-layer`, `.ii-help-btn`
and `.ii-switch`:

| Alias | Host token | Fallback |
|---|---|---|
| `--ii-t-surface-elevated` | `--surface-elevated` | `#161925` |
| `--ii-t-fg1` | `--fg1` | `#f0f2ff` |
| `--ii-t-fg2` | `--fg2` | `#8b93b5` |
| `--ii-t-border` | `--border` | `rgba(255, 255, 255, 0.08)` |
| `--ii-t-primary-solid` | `--primary-solid` | `#008aff` |
| `--ii-t-primary-solid-hover` | `--primary-solid-hover` | `#0180ed` |
| `--ii-t-primary-on-solid` | `--primary-on-solid` | `#ffffff` |
| `--ii-t-primary-text` | `--primary-text` | `#399cfe` |
| `--ii-t-ring` | `--ring` | `rgba(0, 138, 255, 0.40)` |
| `--ii-t-radius` | `--radius` | `12px` |
| `--ii-t-radius-card` | `--radius-card` | `20px` |
| `--ii-t-radius-pill` | `--radius-pill` | `9999px` |
| `--ii-t-shadow-elevated` | `--shadow-elevated` | think preset shadow |
| `--ii-t-font-body` | `--font-body` | `system-ui, sans-serif` |
| `--ii-t-font-heading` | `--font-heading` | `system-ui, sans-serif` |
| `--ii-t-hover-overlay` | `--hover-overlay` | `rgba(255, 255, 255, 0.06)` |
| `--ii-t-ease-entrance` | `--ease-entrance` | `cubic-bezier(0.16, 1, 0.3, 1)` |

Three private knobs on `.ii-layer` have no host token: `--ii-scrim`
(`rgba(0, 0, 0, 0.55)`), `--ii-z` (`1400`) and `--ii-popover-width` (`340px`).
Override them in your own CSS with a selector at least as specific, e.g.
`.ii-layer { --ii-z: 2000; }` loaded after the package stylesheet.

## Accessibility

- The popover is `role="dialog"` with `aria-modal="true"`, labelled by the step
  title and described by its body.
- The progress line (`Step n of m`) is an `aria-live="polite"` region.
- Initial focus goes to the primary button; Tab and Shift+Tab are trapped inside
  the popover; closing restores focus to what had it before (usually the help
  button).
- Keys: `Esc` skips, `→` next, `←` back.
- The help button has an accessible name (default "Start page intro", override
  with `label`) and is disabled when the page has no intro. The switch is a real
  `role="switch"` with `aria-checked` and a visible label.
- `prefers-reduced-motion` turns off the popover entrance and the spotlight
  transition, and uses instant scrolling.
- Step text is rendered as text. There is no HTML path.

## Development

```bash
pnpm install
pnpm verify          # typecheck, typecheck:browser, unit tests, build
pnpm test:browser    # Playwright against demo/ (needs: pnpm exec playwright install chromium)
pnpm demo            # the demo page on http://localhost:5181
pnpm dev             # rebuild dist/ on change
```

jsdom has no layout engine, so the unit tests cover the rules and
`tests/` covers geometry in a real browser. The capture CLI imports
`dist/schema.js`, so build before running `pnpm test:browser`.

`dist/index.js` starts with `"use client"` (the provider uses state and effects);
`dist/schema.js` deliberately does not, so Node scripts and server code can import
it freely.

## Releasing

Releases are published to npm by hand; CI only verifies. `dist/` is not
committed and nothing builds it on publish, so build first:

```bash
pnpm verify
pnpm test:browser
npm version patch                 # or minor / major; commits and tags
pnpm publish                      # public, per publishConfig
git push --follow-tags
```

`pnpm publish` refuses to run from a dirty tree or off `main`. Check what goes
into the tarball beforehand with `pnpm pack --dry-run`: it should be `dist/`,
`bin/`, `styles.css`, `README.md`, `LICENSE` and `package.json`.

## License

MIT
