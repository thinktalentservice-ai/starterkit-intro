#!/usr/bin/env node
// starterkit-intro — scaffold and maintain per-page intro files from a running app.
//
//   starterkit-intro list    --next-app src/app          what would be captured, no browser
//   starterkit-intro capture --next-app src/app          write/merge public/intro/<route>.json
//   starterkit-intro capture --url http://localhost:3000/dashboard
//
// capture opens each page, finds every visible [data-intro="key"] element and
// the layout landmarks, and merges them into the page's intro file WITHOUT
// touching anything a person wrote: new elements are appended as drafts, steps
// whose target has vanished are marked stale, nothing is ever deleted.
//
// Needs Playwright in the project that runs it (`playwright` or
// `@playwright/test`); this package does not depend on it.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { normalizeRoute, routeToIntroPath, validateIntro } from "../dist/schema.js";

const HELP = `starterkit-intro <command> [options]

Commands
  list      Print route -> url -> output file for every route. No browser.
  capture   Open each page and create or merge its intro file.

Where to look (one of these is required)
  --url <url>          A page to capture. Repeat for several. The route is the
                       URL's pathname minus the base path.
  --next-app <dir>     Derive routes from page.{js,jsx,ts,tsx} files under this
                       Next.js app directory (e.g. src/app). Route groups
                       "(x)" and "@slots" are dropped; "[dynamic]" routes are
                       skipped and listed by name.
  --route <route>      Only these routes. Repeat for several.
  --exclude <prefix>   Drop this route and everything under it (e.g. /login).
                       Repeat for several. Applied after --route.

Options
  --origin <url>       Dev server for --next-app    (default: $INTRO_ORIGIN or http://localhost:3000)
  --base-path <path>   Next basePath. Default: $NEXT_PUBLIC_BASE_PATH, then
                       .env.local / .env.development / .env
  --out <dir>          Where intro files go                 (default: public/intro)
  --storage-state <f>  Playwright storage state, for pages behind a login
  --wait <ms>          Extra time after load                (default: 1500)
  --viewport <WxH>     Browser viewport                     (default: 1440x900)
  --landmarks <csv>    Layout selectors proposed as optional steps
                                                            (default: .il-topbar,.il-sidebar)
  --no-landmarks       Propose no landmark steps (existing ones are kept)
  --color-scheme <s>   light | dark | no-preference
  --help

Mark an element with data-intro="key" and it becomes a step. Existing steps are
matched by id (or by identical target) and keep every field a person edited.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string", multiple: true },
    "next-app": { type: "string" },
    route: { type: "string", multiple: true },
    exclude: { type: "string", multiple: true },
    origin: { type: "string" },
    "base-path": { type: "string" },
    out: { type: "string", default: "public/intro" },
    "storage-state": { type: "string" },
    wait: { type: "string", default: "1500" },
    viewport: { type: "string", default: "1440x900" },
    landmarks: { type: "string", default: ".il-topbar,.il-sidebar" },
    "no-landmarks": { type: "boolean", default: false },
    "color-scheme": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

const fail = (message) => {
  console.error(`starterkit-intro: ${message}`);
  process.exit(1);
};

const command = positionals[0];
if (values.help || !command) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}
if (command !== "list" && command !== "capture") fail(`unknown command "${command}".\n\n${HELP}`);
if (!values.url?.length && !values["next-app"]) fail(`give --url or --next-app.\n\n${HELP}`);

const ROOT = process.cwd();
const readIfThere = (file) => (existsSync(path.join(ROOT, file)) ? readFileSync(path.join(ROOT, file), "utf8") : "");

/* ── project facts, read rather than typed ───────────────────────────────── */

function basePathFromEnvFiles() {
  for (const file of [".env.local", ".env.development", ".env"]) {
    const match = readIfThere(file).match(/^\s*NEXT_PUBLIC_BASE_PATH\s*=\s*(.*?)\s*$/m);
    if (match) return match[1].replace(/^(['"])(.*)\1$/, "$2");
  }
  return "";
}

/* A text match, not an import: the config may need env this script does not have. */
const TRAILING_SLASH = ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"].some((file) =>
  /\btrailingSlash\s*:\s*true\b/.test(readIfThere(file)),
);

function cleanBasePath(raw) {
  const trimmed = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const basePath = cleanBasePath(
  values["base-path"] !== undefined ? values["base-path"] : (process.env.NEXT_PUBLIC_BASE_PATH ?? basePathFromEnvFiles()),
);
const defaultOrigin = (values.origin ?? process.env.INTRO_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");

const wait = Number(values.wait);
const viewportMatch = /^(\d+)x(\d+)$/.exec(values.viewport);
if (!Number.isFinite(wait) || wait < 0) fail("--wait must be a number of milliseconds.");
if (!viewportMatch) fail("--viewport must look like 1440x900.");
const viewport = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) };

/* A landmark becomes a step's target, and a position in the page is not a
   stable address: "the second child" points at something else after the next
   edit. Refuse them here so no generated file can contain one. */
const POSITIONAL = /:(nth-[a-z-]+|first-child|last-child|only-child|first-of-type|last-of-type|only-of-type)\b/i;
/* --no-landmarks: propose none. Steps already in a file that target a landmark
   are untouched — they are still probed, so their stale flag stays honest. */
const landmarks = (values["no-landmarks"] ? "" : values.landmarks)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
for (const selector of landmarks) {
  if (POSITIONAL.test(selector)) fail(`--landmarks: "${selector}" is positional. Use a class, id or attribute selector.`);
}

/* ── routes ──────────────────────────────────────────────────────────────── */

const PAGE_FILE = /^page\.[jt]sx?$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const file = path.join(dir, entry);
    if (statSync(file).isDirectory()) walk(file, out);
    else if (PAGE_FILE.test(entry)) out.push(file);
  }
  return out;
}

/** A page file's folder as a URL route, or the reason it has none. */
function routeOf(segments) {
  const kept = [];
  for (const segment of segments) {
    if (/^\(.*\)$/.test(segment) || segment.startsWith("@")) continue; // groups and slots are not URL segments
    if (segment.startsWith("[")) return { skip: `dynamic segment "${segment}" needs a value` };
    if (segment.startsWith("_")) return { skip: `private folder "${segment}" is not routable` };
    kept.push(segment);
  }
  const route = normalizeRoute("/" + kept.join("/"));
  if (route === null) return { skip: `"/${kept.join("/")}" is not a legal intro route` };
  return { route };
}

/** The route a URL's pathname stands for once the base path is taken off. */
function routeFromPathname(pathname) {
  let rest = pathname;
  if (basePath && (rest === basePath || rest.startsWith(`${basePath}/`))) rest = rest.slice(basePath.length) || "/";
  return normalizeRoute(rest);
}

const routes = new Map(); // route -> { url, source }
const skipped = []; // { where, why }

for (const raw of values.url ?? []) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`--url ${JSON.stringify(raw)} is not a valid URL.`);
  }
  const route = routeFromPathname(url.pathname);
  if (route === null) {
    skipped.push({ where: raw, why: "its path is not a legal intro route" });
    continue;
  }
  if (!routes.has(route)) routes.set(route, { url: url.href, source: raw });
}

if (values["next-app"]) {
  const appDir = path.resolve(ROOT, values["next-app"]);
  if (!existsSync(appDir) || !statSync(appDir).isDirectory()) fail(`--next-app ${values["next-app"]} is not a directory.`);
  for (const file of walk(appDir)) {
    const rel = path.relative(appDir, path.dirname(file)).split(path.sep).filter(Boolean);
    const found = routeOf(rel);
    const display = path.relative(ROOT, file).split(path.sep).join("/");
    if (found.skip) {
      skipped.push({ where: display, why: found.skip });
      continue;
    }
    if (routes.has(found.route)) continue;
    const suffix = found.route === "/" ? "/" : found.route + (TRAILING_SLASH ? "/" : "");
    routes.set(found.route, { url: defaultOrigin + basePath + suffix, source: display });
  }
}

if (values.route?.length) {
  const wanted = new Set(
    values.route.map((r) => {
      const normalized = normalizeRoute(r);
      if (normalized === null) fail(`--route ${JSON.stringify(r)} is not a legal route.`);
      return normalized;
    }),
  );
  for (const route of [...routes.keys()]) if (!wanted.has(route)) routes.delete(route);
  for (const route of wanted) if (!routes.has(route)) fail(`--route ${route} matches nothing derived from --url / --next-app.`);
}

/* Segment-aware, so --exclude /login drops /login and /login/user but not /loginx.
   An exclude that matches nothing fails: it is almost always a typo, and a typo'd
   exclude silently captures the pages it was meant to keep out. */
if (values.exclude?.length) {
  for (const raw of values.exclude) {
    const prefix = normalizeRoute(raw);
    if (prefix === null) fail(`--exclude ${JSON.stringify(raw)} is not a legal route.`);
    const hit = (route) => prefix === "/" || route === prefix || route.startsWith(prefix + "/");
    const matched = [...routes.keys()].filter(hit);
    if (!matched.length) fail(`--exclude ${prefix} matches no route.`);
    for (const route of matched) routes.delete(route);
  }
}

const outDir = path.resolve(ROOT, values.out);
const outFileOf = (route) => {
  const rel = routeToIntroPath(route);
  const file = rel === null ? null : path.resolve(outDir, rel);
  // Belt and braces behind normalizeRoute: never write outside the folder asked for.
  return file && file.startsWith(outDir + path.sep) ? file : null;
};
const shown = (file) => path.relative(ROOT, file).split(path.sep).join("/") || file;

const skippedReport = () => {
  for (const s of skipped) console.error(`  skipped ${s.where}: ${s.why}`);
};

if (routes.size === 0) {
  skippedReport();
  fail("no routes to work on.");
}

/* ── list ────────────────────────────────────────────────────────────────── */

if (command === "list") {
  for (const [route, info] of routes) {
    const file = outFileOf(route);
    console.log(`${route}\n    ${info.url}\n    ${file ? shown(file) : "(no safe output path)"}`);
  }
  skippedReport();
  process.exit(0);
}

/* ── capture ─────────────────────────────────────────────────────────────── */

if (values["storage-state"] && !existsSync(path.resolve(ROOT, values["storage-state"]))) {
  fail(`--storage-state ${values["storage-state"]} does not exist.`);
}

/** Playwright from the project running the command, not from this package. */
async function loadChromium() {
  const fromProject = createRequire(path.join(ROOT, "package.json"));
  for (const id of ["playwright", "@playwright/test"]) {
    try {
      const mod = await import(pathToFileURL(fromProject.resolve(id)).href);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      // try the next one
    }
  }
  return fail("Playwright is not installed here. Add it with: pnpm add -D playwright   (then: pnpm exec playwright install chromium)");
}

/* Asked first because the alternative is a Playwright navigation error per
   route, none of which says "start the dev server". */
async function probe(origin) {
  const { hostname, port, protocol } = new URL(origin);
  return new Promise((resolve) => {
    const socket = net.connect({ host: hostname, port: Number(port) || (protocol === "https:" ? 443 : 80) });
    const done = (up) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(3000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

for (const origin of new Set([...routes.values()].map((r) => new URL(r.url).origin))) {
  if (!(await probe(origin))) {
    fail(`nothing is listening at ${origin}.\n  A capture is measured from the running app: start the dev server (e.g. pnpm dev), or point --origin / --url at it.`);
  }
}

/** Runs in the page: everything the merge needs, as plain data. Self-contained on purpose. */
function collect(args) {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  };
  const squash = (text) => (text || "").replace(/\s+/g, " ").trim();
  const humanize = (key) => {
    const words = key.replace(/[^A-Za-z0-9]+/g, " ").trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
  };
  // innerText, not textContent: textContent includes <style>/<script> bodies and
  // hidden nodes, so a region holding an inline stylesheet "titled" itself with CSS.
  const textOf = (el) => squash(el.innerText ?? el.textContent);
  const titleOf = (el, fallbackKey, region = false) => {
    const explicit = squash(el.getAttribute("data-intro-title"));
    if (explicit) return explicit;
    const label = squash(el.getAttribute("aria-label"));
    if (label) return label;
    const heading = el.querySelector("h1, h2, h3, h4");
    const headingText = heading ? textOf(heading) : "";
    if (headingText) return headingText;
    // A layout region's own text is every label inside it run together — no use as a title.
    if (region) return humanize(fallbackKey);
    const text = textOf(el).slice(0, 60);
    return text || humanize(fallbackKey);
  };

  const h1 = document.querySelector("h1");
  const items = [];
  for (const el of document.querySelectorAll("[data-intro]")) {
    if (!visible(el)) continue;
    const key = el.getAttribute("data-intro") || "";
    items.push({ key, title: titleOf(el, key) });
  }
  const found = args.landmarks.map((selector) => {
    try {
      const match = Array.from(document.querySelectorAll(selector)).find(visible);
      return { selector, found: !!match, title: match ? titleOf(match, selector, true) : "" };
    } catch {
      return { selector, found: false, title: "" };
    }
  });
  const probes = {};
  for (const selector of args.probes) {
    try {
      probes[selector] = Array.from(document.querySelectorAll(selector)).some(visible);
    } catch {
      probes[selector] = false;
    }
  }
  // Many app pages style a div as their heading; fall back to the document title.
  return { h1: (h1 && textOf(h1)) || squash(document.title), items, landmarks: found, probes };
}

/* ── merge ───────────────────────────────────────────────────────────────── */

const STEP_ORDER = ["id", "target", "title", "body", "placement", "optional", "draft", "stale"];
const DOC_ORDER = ["$schema", "schema", "route", "revision", "title", "steps"];

const ordered = (object, keys) => Object.fromEntries(keys.filter((k) => object[k] !== undefined).map((k) => [k, object[k]]));
const clip = (text, max) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);

/** A key as a step id, or null when nothing usable is left of it. */
function slug(text) {
  const id = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
  return id || null;
}

function uniqueId(base, taken) {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 60)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Selectors this tool is willing to write: a data attribute value that needs no escaping. */
const SAFE_KEY = /^[^"\\\u0000-\u001f]+$/;

function buildDoc(route, existing, page) {
  const warnings = [];
  const doc = existing
    ? structuredClone(existing)
    : {
        schema: 1,
        route,
        revision: 1,
        title: clip(page.h1 || route, 80),
        steps: [{ id: "welcome", title: clip(`Welcome to ${page.h1 || route}`, 80), body: "", draft: true }],
      };

  const taken = new Set(doc.steps.map((s) => s.id));
  // Ids a person (or an earlier capture) already owns. The scaffolded welcome step
  // is ours, so a data-intro="welcome" element gets "welcome-2" instead of vanishing.
  const ownedIds = new Set(existing ? existing.steps.map((s) => s.id) : []);
  const knownTargets = new Set(doc.steps.map((s) => s.target).filter(Boolean));

  // Existing steps: only the stale flag is ours to change.
  for (const step of doc.steps) {
    if (!step.target) {
      delete step.stale;
    } else if (page.probes[step.target]) {
      delete step.stale;
    } else {
      step.stale = true;
    }
  }

  const seenKeys = new Set();
  const append = (step) => {
    doc.steps.push(step);
    taken.add(step.id);
    knownTargets.add(step.target);
  };

  for (const item of page.items) {
    if (!item.key) {
      warnings.push('an element has an empty data-intro attribute; ignored');
      continue;
    }
    if (seenKeys.has(item.key)) {
      warnings.push(`data-intro="${item.key}" appears more than once; keeping the first`);
      continue;
    }
    seenKeys.add(item.key);
    if (!SAFE_KEY.test(item.key)) {
      warnings.push(`data-intro=${JSON.stringify(item.key)} contains a quote, backslash or control character; ignored`);
      continue;
    }
    const target = `[data-intro="${item.key}"]`;
    const base = slug(item.key);
    if (!base || target.length > 200) {
      warnings.push(`data-intro=${JSON.stringify(item.key)} cannot be turned into a step id/target; ignored`);
      continue;
    }
    if (knownTargets.has(target) || ownedIds.has(base)) continue;
    append({ id: uniqueId(base, taken), target, title: clip(item.title || item.key, 80), body: "", draft: true });
  }

  for (const landmark of page.landmarks) {
    if (!landmark.found) continue;
    const base = slug(landmark.selector);
    if (!base || landmark.selector.length > 200) continue;
    if (knownTargets.has(landmark.selector) || ownedIds.has(base)) continue;
    append({
      id: uniqueId(base, taken),
      target: landmark.selector,
      title: clip(landmark.title || base, 80),
      body: "",
      optional: true,
      draft: true,
    });
  }

  const steps = doc.steps.map((s) => ordered(s, STEP_ORDER));
  const out = ordered({ ...doc, steps }, DOC_ORDER);
  // The scaffolded welcome step of a new document counts as added too.
  const added = steps.length - (existing ? existing.steps.length : 0);
  return { doc: out, added, stale: steps.filter((s) => s.stale).length, warnings };
}

/** The existing file, parsed and validated; null when there is none. Throws on a bad one. */
async function readExisting(file, route) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`${shown(file)} is not valid JSON (${error.message}); left untouched`);
  }
  const result = validateIntro(json);
  if (!result.ok) throw new Error(`${shown(file)} is not a valid intro; left untouched:\n      ${result.errors.join("\n      ")}`);
  if (result.doc.route !== route) throw new Error(`${shown(file)} is for route "${result.doc.route}", not "${route}"; left untouched`);
  return json;
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const chromium = await loadChromium();
/* Playwright installed but its browser binary is not (or is for another
   Playwright version) throws a boxed banner plus a stack trace from deep in
   this file. Say the one command that fixes it instead. */
let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Executable doesn't exist|playwright install/i.test(message)) {
    fail("Playwright's Chromium is not installed for this project's Playwright version.\n  Run: pnpm exec playwright install chromium-headless-shell");
  }
  throw error;
}
const failures = [];
let written = 0;

try {
  const context = await browser.newContext({
    viewport,
    ...(values["color-scheme"] ? { colorScheme: values["color-scheme"] } : {}),
    ...(values["storage-state"] ? { storageState: path.resolve(ROOT, values["storage-state"]) } : {}),
  });

  for (const [route, info] of routes) {
    const page = await context.newPage();
    try {
      const file = outFileOf(route);
      if (!file) throw new Error("no safe output path");

      const response = await page.goto(info.url, { waitUntil: "load" });
      await page.waitForTimeout(wait);
      if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()} from ${info.url}`);

      const finalPath = new URL(page.url()).pathname;
      if (routeFromPathname(finalPath) !== route) {
        throw new Error(`redirected to ${finalPath} — pass --storage-state (e.g. from pnpm debug:login)`);
      }

      const existing = await readExisting(file, route);
      const probes = existing ? [...new Set(existing.steps.map((s) => s.target).filter(Boolean))] : [];
      const found = await page.evaluate(collect, { landmarks, probes });

      const merged = buildDoc(route, existing, found);
      for (const warning of merged.warnings) console.warn(`  ! ${route}: ${warning}`);

      const check = validateIntro(merged.doc);
      if (!check.ok) throw new Error(`result would not validate; nothing written:\n      ${check.errors.join("\n      ")}`);

      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify(merged.doc, null, 2)}\n`);
      written++;
      console.log(`✓ ${shown(file)} (+${merged.added} added, ${merged.stale} stale, ${merged.doc.steps.length} total)`);
    } catch (error) {
      failures.push({ route, message: error instanceof Error ? error.message : String(error) });
    } finally {
      await page.close();
    }
  }
  await context.close();
} finally {
  await browser.close();
}

skippedReport();
for (const f of failures) console.error(`✖ ${f.route}: ${f.message}`);
if (written === 0 && failures.length === 0) console.error("✖ nothing written.");
if (failures.length > 0 || written === 0) process.exit(1);
