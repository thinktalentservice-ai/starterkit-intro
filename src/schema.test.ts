import { describe, expect, it } from "vitest";
import { INTRO_SCHEMA_VERSION, normalizeRoute, routeToIntroPath, validateIntro } from "./schema";

const step = (over: Record<string, unknown> = {}) => ({ id: "a", title: "A", body: "Body", ...over });
const doc = (over: Record<string, unknown> = {}) => ({
  schema: 1,
  route: "/",
  revision: 1,
  steps: [step()],
  ...over,
});
const errorsOf = (json: unknown) => {
  const result = validateIntro(json);
  return result.ok ? [] : result.errors;
};

describe("normalizeRoute", () => {
  it.each([
    ["/", "/"],
    ["/design/badge", "/design/badge"],
    ["/design/badge/", "/design/badge"],
    ["//design///badge//", "/design/badge"],
    ["/a?x=1", "/a"],
    ["/a#frag", "/a"],
    ["/a/?x=1#y", "/a"],
    ["/?x=1", "/"],
    ["/v1.2/a_b~c-d", "/v1.2/a_b~c-d"],
    ["/a/index", "/a/index"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeRoute(input)).toBe(expected);
  });

  it.each([
    "",
    "design",
    "?x=1",
    "#a",
    "/a/../b",
    "/a/./b",
    "/..",
    "/.",
    "/a%2Fb",
    "/%2e%2e",
    "/a\\b",
    "/a b",
    "/a/é",
    "/index",
    "/index/",
    "/index?x=1",
  ])("rejects %j", (input) => {
    expect(normalizeRoute(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(normalizeRoute(undefined as unknown as string)).toBeNull();
  });
});

describe("routeToIntroPath", () => {
  it("maps root to index.json", () => expect(routeToIntroPath("/")).toBe("index.json"));
  it("maps nested paths and drops the trailing slash", () => {
    expect(routeToIntroPath("/design/badge/")).toBe("design/badge.json");
    expect(routeToIntroPath("/design/badge?x=1")).toBe("design/badge.json");
  });
  it("is null for invalid routes", () => {
    expect(routeToIntroPath("/../x")).toBeNull();
    expect(routeToIntroPath("/index")).toBeNull();
    expect(routeToIntroPath("nope")).toBeNull();
  });
});

describe("validateIntro", () => {
  it("exports the schema version", () => expect(INTRO_SCHEMA_VERSION).toBe(1));

  it("accepts a minimal document and the optional $schema key", () => {
    expect(validateIntro(doc()).ok).toBe(true);
    expect(validateIntro(doc({ $schema: "https://x/y.json", title: "Home" })).ok).toBe(true);
  });

  it("accepts every step field", () => {
    const full = step({ target: "[data-intro='x']", placement: "left", optional: true, draft: false, stale: false });
    expect(validateIntro(doc({ steps: [full] })).ok).toBe(true);
  });

  it("rejects non-objects", () => {
    for (const bad of [null, undefined, 1, "x", [], true]) expect(validateIntro(bad).ok).toBe(false);
  });

  it("reports a wrong schema version, route, revision", () => {
    expect(errorsOf(doc({ schema: 2 }))).toEqual(["schema: must be 1"]);
    expect(errorsOf(doc({ route: "/a/" }))[0]).toMatch(/^route:/);
    expect(errorsOf(doc({ route: 3 }))[0]).toMatch(/^route:/);
    for (const revision of [0, -1, 1.5, "1", null]) {
      expect(errorsOf(doc({ revision }))[0]).toMatch(/^revision:/);
    }
  });

  it("checks the document title", () => {
    expect(errorsOf(doc({ title: "" }))[0]).toMatch(/^title:/);
    expect(errorsOf(doc({ title: "x".repeat(81) }))[0]).toMatch(/^title:/);
    expect(validateIntro(doc({ title: "x".repeat(80) })).ok).toBe(true);
    expect(errorsOf(doc({ title: 4 }))[0]).toMatch(/^title:/);
  });

  it("bounds the step count", () => {
    expect(errorsOf(doc({ steps: [] }))[0]).toMatch(/^steps:/);
    expect(errorsOf(doc({ steps: "x" }))[0]).toMatch(/^steps:/);
    const many = Array.from({ length: 31 }, (_, i) => step({ id: `s${i}` }));
    expect(errorsOf(doc({ steps: many }))[0]).toMatch(/^steps:/);
    expect(validateIntro(doc({ steps: many.slice(0, 30) })).ok).toBe(true);
  });

  it("collects ALL errors with indexed paths", () => {
    const errors = errorsOf(
      doc({
        revision: 0,
        steps: [step(), step({ id: "Bad Id", title: "   " }), step({ id: "c", body: "x".repeat(401), target: "" })],
      }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^revision:/),
        expect.stringMatching(/^steps\[1\]\.id:/),
        expect.stringMatching(/^steps\[1\]\.title:/),
        expect.stringMatching(/^steps\[2\]\.body:/),
        expect.stringMatching(/^steps\[2\]\.target:/),
      ]),
    );
    expect(errors).toHaveLength(5);
  });

  it("rejects duplicate and malformed ids", () => {
    expect(errorsOf(doc({ steps: [step(), step()] }))).toEqual(['steps[1].id: duplicate id "a"']);
    for (const id of ["", "-a", "A", "a_b", "a".repeat(65), 3]) {
      expect(errorsOf(doc({ steps: [step({ id })] }))[0]).toMatch(/^steps\[0\]\.id:/);
    }
    expect(validateIntro(doc({ steps: [step({ id: "a".repeat(64) })] })).ok).toBe(true);
  });

  it("requires a non-empty body unless draft", () => {
    expect(errorsOf(doc({ steps: [step({ body: "" })] }))[0]).toMatch(/^steps\[0\]\.body:/);
    expect(errorsOf(doc({ steps: [step({ body: "  \n " })] }))[0]).toMatch(/^steps\[0\]\.body:/);
    expect(errorsOf(doc({ steps: [step({ body: "", draft: false })] }))[0]).toMatch(/body/);
    expect(validateIntro(doc({ steps: [step({ body: "", draft: true })] })).ok).toBe(true);
    expect(errorsOf(doc({ steps: [step({ body: undefined })] }))[0]).toMatch(/body: must be a string/);
  });

  it("limits title, body and target lengths", () => {
    expect(errorsOf(doc({ steps: [step({ title: "x".repeat(81) })] }))[0]).toMatch(/title/);
    expect(validateIntro(doc({ steps: [step({ body: "x".repeat(400) })] })).ok).toBe(true);
    expect(validateIntro(doc({ steps: [step({ target: "x".repeat(200) })] })).ok).toBe(true);
    expect(errorsOf(doc({ steps: [step({ target: "x".repeat(201) })] }))[0]).toMatch(/target/);
    expect(errorsOf(doc({ steps: [step({ target: 3 })] }))[0]).toMatch(/target/);
  });

  it("checks placement and boolean flags", () => {
    expect(errorsOf(doc({ steps: [step({ placement: "middle" })] }))[0]).toMatch(/placement/);
    for (const flag of ["optional", "draft", "stale"]) {
      expect(errorsOf(doc({ steps: [step({ [flag]: "yes", body: "x" })] }))[0]).toMatch(new RegExp(`${flag}: must be a boolean`));
    }
  });

  it("treats unknown keys as errors at both levels", () => {
    expect(errorsOf(doc({ colour: 1 }))).toEqual(["colour: unknown key"]);
    expect(errorsOf(doc({ steps: [step({ placment: "top" })] }))).toEqual(["steps[0].placment: unknown key"]);
  });

  it("does not allow $schema on a step", () => {
    expect(errorsOf(doc({ steps: [step({ $schema: "x" })] }))).toEqual(["steps[0].$schema: unknown key"]);
  });
});
