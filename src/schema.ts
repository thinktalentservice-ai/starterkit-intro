/* The intro document format. Pure: no DOM, no React, no Node built-ins — it is
   imported by the runtime, by bin/starterkit-intro.mjs and by a host's build
   gate, and all three must get identical answers about what a legal document is. */

export const INTRO_SCHEMA_VERSION = 1;

export type IntroPlacement = "auto" | "top" | "bottom" | "left" | "right";

export interface IntroStep {
  /** Unique within the document. `[a-z0-9][a-z0-9-]{0,63}`. */
  id: string;
  /** CSS selector. Omit for a centred step with no spotlight. */
  target?: string;
  title: string;
  /** Plain text. Never rendered as HTML. May be empty only while `draft`. */
  body: string;
  placement?: IntroPlacement;
  /** A missing target on an optional step is skipped without a warning. */
  optional?: boolean;
  /** Written by the capture CLI, not yet reviewed: never shown to users. */
  draft?: boolean;
  /** The capture CLI no longer finds this step's target on the page. */
  stale?: boolean;
}

export interface IntroDocument {
  schema: 1;
  /** Normalised pathname the document belongs to: "/" or "/design/badge". */
  route: string;
  /** Bump to show the tour again to people who already finished it. */
  revision: number;
  title?: string;
  steps: IntroStep[];
}

export type IntroValidation = { ok: true; doc: IntroDocument } | { ok: false; errors: string[] };

const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const STEP_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PLACEMENTS: readonly string[] = ["auto", "top", "bottom", "left", "right"];
const DOC_KEYS = new Set(["$schema", "schema", "route", "revision", "title", "steps"]);
const STEP_KEYS = new Set(["id", "target", "title", "body", "placement", "optional", "draft", "stale"]);

/**
 * A pathname reduced to the one spelling a document can be filed under, or
 * null when it is not safe to turn into a file name. Rejecting is deliberate:
 * a route becomes a path on disk (CLI) and in a URL (runtime), so anything that
 * could climb out of the folder, double-encode, or collide is refused rather
 * than repaired.
 */
export function normalizeRoute(pathname: string): string | null {
  if (typeof pathname !== "string") return null;
  let path = pathname;
  const cut = path.search(/[?#]/);
  if (cut !== -1) path = path.slice(0, cut);
  if (path.includes("%") || path.includes("\\")) return null;
  if (!path.startsWith("/")) return null;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") return path;
  const segments = path.slice(1).split("/");
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment === "." || segment === "..") return null;
  }
  // "/index" would be filed as index.json, which is the root's file.
  if (path === "/index") return null;
  return path;
}

/** "/" -> "index.json", "/design/badge/" -> "design/badge.json", else null. */
export function routeToIntroPath(pathname: string): string | null {
  const route = normalizeRoute(pathname);
  if (route === null) return null;
  return route === "/" ? "index.json" : `${route.slice(1)}.json`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function validateIntro(json: unknown): IntroValidation {
  const errors: string[] = [];
  if (!isRecord(json)) return { ok: false, errors: ["document: must be an object"] };

  for (const key of Object.keys(json)) {
    if (!DOC_KEYS.has(key)) errors.push(`${key}: unknown key`);
  }
  if ("$schema" in json && typeof json["$schema"] !== "string") errors.push("$schema: must be a string");

  if (json["schema"] !== INTRO_SCHEMA_VERSION) errors.push(`schema: must be ${INTRO_SCHEMA_VERSION}`);

  const route = json["route"];
  if (typeof route !== "string") errors.push("route: must be a string");
  else if (normalizeRoute(route) !== route) errors.push("route: must be a normalised pathname such as \"/\" or \"/design/badge\"");

  const revision = json["revision"];
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 1) {
    errors.push("revision: must be a positive integer");
  }

  if ("title" in json) {
    const title = json["title"];
    if (typeof title !== "string" || title.length < 1 || title.length > 80) {
      errors.push("title: must be a string of 1 to 80 characters");
    }
  }

  const steps = json["steps"];
  if (!Array.isArray(steps)) errors.push("steps: must be an array");
  else {
    if (steps.length < 1 || steps.length > 30) errors.push("steps: must hold 1 to 30 steps");
    const seen = new Set<string>();
    steps.forEach((step: unknown, i) => {
      const at = `steps[${i}]`;
      if (!isRecord(step)) {
        errors.push(`${at}: must be an object`);
        return;
      }
      for (const key of Object.keys(step)) {
        if (!STEP_KEYS.has(key)) errors.push(`${at}.${key}: unknown key`);
      }

      const id = step["id"];
      if (typeof id !== "string" || !STEP_ID.test(id)) {
        errors.push(`${at}.id: must match ${STEP_ID.source}`);
      } else if (seen.has(id)) errors.push(`${at}.id: duplicate id "${id}"`);
      else seen.add(id);

      const title = step["title"];
      if (typeof title !== "string" || title.trim().length < 1 || title.length > 80) {
        errors.push(`${at}.title: must be a non-empty string of at most 80 characters`);
      }

      const body = step["body"];
      if (typeof body !== "string") errors.push(`${at}.body: must be a string`);
      else if (body.length > 400) errors.push(`${at}.body: must be at most 400 characters`);
      else if (body.trim().length === 0 && step["draft"] !== true) {
        errors.push(`${at}.body: must not be empty (only a draft step may have an empty body)`);
      }

      if ("target" in step) {
        const target = step["target"];
        if (typeof target !== "string" || target.length < 1 || target.length > 200) {
          errors.push(`${at}.target: must be a string of 1 to 200 characters`);
        }
      }
      if ("placement" in step) {
        const placement = step["placement"];
        if (typeof placement !== "string" || !PLACEMENTS.includes(placement)) {
          errors.push(`${at}.placement: must be one of ${PLACEMENTS.join(", ")}`);
        }
      }
      for (const flag of ["optional", "draft", "stale"] as const) {
        if (flag in step && typeof step[flag] !== "boolean") errors.push(`${at}.${flag}: must be a boolean`);
      }
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, doc: json as unknown as IntroDocument };
}
