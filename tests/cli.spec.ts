import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

/* The capture CLI against the demo page. It imports dist/schema.js, so this
   needs `pnpm build` first (pnpm verify does that). Playwright is resolved from
   this repo's own node_modules, exactly as it would be from a host project. */

const execFileAsync = promisify(execFile);
const CLI = path.resolve("bin/starterkit-intro.mjs");

const run = (args: string[]) =>
  execFileAsync(process.execPath, [CLI, ...args], { cwd: path.resolve("."), timeout: 90_000 }).then(
    ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
    (error: { code?: number; stdout?: string; stderr?: string }) => ({
      code: error.code ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    }),
  );

const capture = (out: string, extra: string[] = []) =>
  run(["capture", "--url", "http://localhost:5181/", "--base-path", "", "--out", out, "--wait", "300", ...extra]);

type Step = { id: string; target?: string; title: string; body: string; placement?: string; optional?: boolean; draft?: boolean; stale?: boolean };
type Doc = { schema: number; route: string; revision: number; title?: string; steps: Step[] };

let tmp: string;
test.beforeEach(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), "intro-cli-"));
});
test.afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const readDoc = async (file = "index.json"): Promise<Doc> => JSON.parse(await readFile(path.join(tmp, file), "utf8"));

test("first capture scaffolds a draft document from the data-intro keys", async () => {
  const result = await capture(tmp);
  expect(result.stderr).toBe("");
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/✓ .*index\.json \(\+6 added, 0 stale, 6 total\)/);

  const raw = await readFile(path.join(tmp, "index.json"), "utf8");
  expect(raw.endsWith("}\n")).toBe(true);
  expect(raw.startsWith('{\n  "schema": 1,\n  "route": "/",\n  "revision": 1,')).toBe(true);

  const doc = await readDoc();
  expect(doc.steps.map((s) => s.id)).toEqual(["welcome", "alerts", "hero", "features", "pricing", "settings"]);
  expect(doc.steps.every((s) => s.draft === true && s.body === "")).toBe(true);
  expect(doc.steps[0]!.target).toBeUndefined();
  expect(doc.steps[2]!.target).toBe('[data-intro="hero"]');
  expect(raw).not.toMatch(/nth-|:first-child/);
});

test("a re-run keeps human edits, appends new keys as drafts and marks vanished targets stale", async () => {
  await capture(tmp);
  const doc = await readDoc();

  const hero = doc.steps.find((s) => s.id === "hero")!;
  hero.title = "My hero";
  hero.body = "Written by a person.";
  hero.placement = "left";
  delete hero.draft;
  // A step the page never had, a target-less step, and one the page lost since.
  doc.steps = doc.steps.filter((s) => s.id !== "pricing");
  doc.steps.push({ id: "old", target: '[data-intro="gone"]', title: "Gone", body: "Used to exist.", optional: true });
  doc.steps.push({ id: "tip", title: "A tip", body: "No target.", stale: true });
  doc.revision = 7;
  await writeFile(path.join(tmp, "index.json"), JSON.stringify(doc, null, 2));

  const result = await capture(tmp);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/\(\+1 added, 1 stale, 8 total\)/);

  const next = await readDoc();
  const byId = Object.fromEntries(next.steps.map((s) => [s.id, s]));
  expect(byId["hero"]).toMatchObject({ title: "My hero", body: "Written by a person.", placement: "left" });
  expect(byId["hero"]!.draft).toBeUndefined();
  expect(byId["old"]).toMatchObject({ stale: true, optional: true, body: "Used to exist." });
  expect(byId["tip"]!.stale).toBeUndefined();
  expect(byId["pricing"]).toMatchObject({ draft: true, body: "", target: '[data-intro="pricing"]' });
  expect(next.revision).toBe(7);
  // Order is preserved; the new step goes last.
  expect(next.steps.at(-1)!.id).toBe("pricing");
  expect(next.steps.slice(0, 5).map((s) => s.id)).toEqual(["welcome", "alerts", "hero", "features", "settings"]);
});

test("a stale flag is cleared when the target is found again", async () => {
  await capture(tmp);
  const doc = await readDoc();
  doc.steps.find((s) => s.id === "hero")!.stale = true;
  await writeFile(path.join(tmp, "index.json"), JSON.stringify(doc, null, 2));
  await capture(tmp);
  expect((await readDoc()).steps.find((s) => s.id === "hero")!.stale).toBeUndefined();
});

test("an existing file that does not validate is reported and never overwritten", async () => {
  const broken = '{ "schema": 1, "route": "/", "revision": 0, "steps": [] }\n';
  await writeFile(path.join(tmp, "index.json"), broken);
  const result = await capture(tmp);
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("revision");
  expect(await readFile(path.join(tmp, "index.json"), "utf8")).toBe(broken);
});

test("an unreachable origin says to start the dev server", async () => {
  const result = await run(["capture", "--url", "http://localhost:5999/", "--base-path", "", "--out", tmp]);
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/nothing is listening at http:\/\/localhost:5999/);
});

test("list derives routes from a Next app directory without a browser", async () => {
  const app = path.join(tmp, "app");
  for (const dir of ["", "(shell)/design/badge", "users/[id]", "@modal/photo", "_private/x", "blog"]) {
    await mkdir(path.join(app, dir), { recursive: true });
    await writeFile(path.join(app, dir, "page.tsx"), "export default function Page() { return null; }\n");
  }
  const result = await run(["list", "--next-app", app, "--base-path", "/starterkit-user", "--origin", "http://localhost:3000", "--out", "public/intro"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("/design/badge\n    http://localhost:3000/starterkit-user/design/badge\n    public/intro/design/badge.json");
  expect(result.stdout).toContain("/\n    http://localhost:3000/starterkit-user/\n    public/intro/index.json");
  expect(result.stdout).toContain("/blog");
  expect(result.stdout).toContain("/photo");
  expect(result.stderr).toMatch(/users\/\[id\]\/page\.tsx: dynamic segment "\[id\]"/);
  expect(result.stderr).toMatch(/_private/);
});

test("--exclude drops a route and everything under it, and a typo'd exclude fails", async () => {
  const app = path.join(tmp, "app-exclude");
  for (const dir of ["", "login", "login/user", "loginx", "design"]) {
    await mkdir(path.join(app, dir), { recursive: true });
    await writeFile(path.join(app, dir, "page.tsx"), "export default function Page() { return null; }\n");
  }
  const base = ["list", "--next-app", app, "--base-path", "", "--origin", "http://localhost:3000"];
  const result = await run([...base, "--exclude", "/login"]);
  expect(result.code).toBe(0);
  expect(result.stdout).not.toMatch(/^\/login(\/user)?$/m);
  expect(result.stdout).toMatch(/^\/loginx$/m);
  expect(result.stdout).toMatch(/^\/design$/m);
  const typo = await run([...base, "--exclude", "/logn"]);
  expect(typo.code).toBe(1);
  expect(typo.stderr).toMatch(/--exclude \/logn matches no route/);
});

test("the CLI refuses positional landmarks and missing inputs", async () => {
  const positional = await run(["list", "--url", "http://localhost:5181/", "--landmarks", "nav li:nth-child(2)"]);
  expect(positional.code).toBe(1);
  expect(positional.stderr).toContain("positional");
  const none = await run(["list"]);
  expect(none.code).toBe(1);
});
