import { afterEach, describe, expect, it, vi } from "vitest";
import { readIntroState, writeIntroState } from "./storage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("storage", () => {
  it("returns defaults when nothing is stored", () => {
    expect(readIntroState("k")).toEqual({ v: 1, autoStart: true, seen: {} });
  });

  it("round-trips", () => {
    const state = { v: 1 as const, autoStart: false, seen: { "/": 2, "/a": 1 } };
    expect(writeIntroState("k", state)).toBe(true);
    expect(readIntroState("k")).toEqual(state);
  });

  it("keys are independent", () => {
    writeIntroState("a", { v: 1, autoStart: false, seen: {} });
    expect(readIntroState("b").autoStart).toBe(true);
  });

  it.each([
    ["corrupt json", "{not json"],
    ["array", "[]"],
    ["null", "null"],
    ["wrong version", JSON.stringify({ v: 2, autoStart: true, seen: {} })],
    ["autoStart not boolean", JSON.stringify({ v: 1, autoStart: "yes", seen: {} })],
    ["seen missing", JSON.stringify({ v: 1, autoStart: false })],
    ["seen is array", JSON.stringify({ v: 1, autoStart: false, seen: [] })],
    ["seen value not number", JSON.stringify({ v: 1, autoStart: false, seen: { "/": "1" } })],
  ])("falls back to defaults for %s", (_name, raw) => {
    window.localStorage.setItem("k", raw);
    expect(readIntroState("k")).toEqual({ v: 1, autoStart: true, seen: {} });
  });

  it("survives a throwing localStorage on read and write", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(readIntroState("k")).toEqual({ v: 1, autoStart: true, seen: {} });
    expect(writeIntroState("k", { v: 1, autoStart: true, seen: {} })).toBe(false);
  });

  it("survives an inaccessible window.localStorage getter", () => {
    const spy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(readIntroState("k").autoStart).toBe(true);
    expect(writeIntroState("k", { v: 1, autoStart: true, seen: {} })).toBe(false);
    spy.mockRestore();
  });
});
