import { describe, expect, it } from "vitest";
import { computePosition } from "./position";

const viewport = { width: 1000, height: 800 };
const popover = { width: 300, height: 150 };
const base = { popover, viewport };

describe("computePosition", () => {
  it("centres when there is no target", () => {
    expect(computePosition({ ...base, target: null, placement: "bottom" })).toEqual({
      top: 325,
      left: 350,
      placement: "center",
      arrow: null,
    });
  });

  it("auto prefers bottom when it fits and centres on the target", () => {
    const r = computePosition({ ...base, target: { top: 100, left: 400, width: 200, height: 40 }, placement: "auto" });
    expect(r.placement).toBe("bottom");
    expect(r.top).toBe(100 + 40 + 12);
    expect(r.left).toBe(500 - 150);
    expect(r.arrow).toBe(150);
  });

  it("auto picks top when bottom does not fit", () => {
    const r = computePosition({ ...base, target: { top: 700, left: 400, width: 200, height: 40 }, placement: "auto" });
    expect(r.placement).toBe("top");
    expect(r.top).toBe(700 - 12 - 150);
  });

  it("auto picks right when neither vertical side fits", () => {
    const tall = { top: 0, left: 100, width: 100, height: 800 };
    const r = computePosition({ ...base, target: tall, placement: "auto" });
    expect(r.placement).toBe("right");
    expect(r.left).toBe(212);
  });

  it("auto picks left when only left fits", () => {
    const tall = { top: 0, left: 600, width: 400, height: 800 };
    const r = computePosition({ ...base, target: tall, placement: "auto" });
    expect(r.placement).toBe("left");
    expect(r.left).toBe(600 - 12 - 300);
  });

  it("honours a preferred side that fits", () => {
    const r = computePosition({ ...base, target: { top: 400, left: 400, width: 100, height: 40 }, placement: "left" });
    expect(r.placement).toBe("left");
    expect(r.left).toBe(400 - 12 - 300);
    expect(r.top).toBe(420 - 75);
  });

  it("flips to the opposite side when the preferred one does not fit", () => {
    const r = computePosition({ ...base, target: { top: 700, left: 400, width: 100, height: 40 }, placement: "bottom" });
    expect(r.placement).toBe("top");
    const l = computePosition({ ...base, target: { top: 400, left: 100, width: 100, height: 40 }, placement: "left" });
    expect(l.placement).toBe("right");
  });

  it("falls back to any side that fits when preferred and opposite do not", () => {
    const wide = { top: 0, left: 0, width: 1000, height: 800 };
    const r = computePosition({ ...base, target: { top: 10, left: 400, width: 200, height: 780 }, placement: "bottom" });
    expect(r.placement).toBe("right");
    // Nothing fits at all: docked inset, no arrow.
    const none = computePosition({ ...base, target: wide, placement: "top" });
    expect(none.placement).toBe("inset");
    expect(none.arrow).toBeNull();
  });

  it("clamps into the viewport with the margin and keeps the arrow on the target", () => {
    const r = computePosition({ ...base, target: { top: 100, left: 940, width: 50, height: 40 }, placement: "bottom" });
    expect(r.left).toBe(1000 - 300 - 8);
    expect(r.left + 300).toBeLessThanOrEqual(992);
    // Target centre 965; popover left 692 -> 273, clamped to 300 - 16.
    expect(r.arrow).toBe(273);
  });

  it("clamps the arrow at the inset on the near edge", () => {
    const r = computePosition({ ...base, target: { top: 100, left: 0, width: 4, height: 40 }, placement: "bottom" });
    expect(r.left).toBe(8);
    expect(r.arrow).toBe(16);
  });

  it("arrow runs along the vertical edge for left/right placements", () => {
    const r = computePosition({ ...base, target: { top: 10, left: 100, width: 50, height: 20 }, placement: "right" });
    expect(r.placement).toBe("right");
    expect(r.top).toBe(8);
    // Target centre y = 20, popover top clamped to 8 -> 12, held to the 16px inset.
    expect(r.arrow).toBe(16);
  });

  it("respects custom gap and margin", () => {
    const r = computePosition({
      ...base,
      target: { top: 100, left: 400, width: 200, height: 40 },
      placement: "bottom",
      gap: 20,
      margin: 0,
    });
    expect(r.top).toBe(160);
  });

  it("never leaves the margin even if the popover is bigger than the viewport", () => {
    const r = computePosition({
      target: null,
      popover: { width: 2000, height: 2000 },
      viewport,
      placement: "auto",
    });
    expect(r.left).toBe(8);
    expect(r.top).toBe(8);
  });

  it("docks inset at the viewport bottom, centred on the visible target, when no side fits", () => {
    // A section taller than the viewport with a 258px gutter to its left: the
    // old fallback squeezed the popover into that gutter, over the sidebar.
    const vp = { width: 1440, height: 900 };
    const r = computePosition({
      target: { top: 95, left: 258, width: 1164, height: 1400 },
      popover: { width: 340, height: 220 },
      viewport: vp,
      placement: "auto",
    });
    expect(r.placement).toBe("inset");
    expect(r.arrow).toBeNull();
    expect(r.top).toBe(900 - 220 - 8);
    expect(r.left).toBe(Math.round((258 + 1422) / 2 - 170));
  });

  it("an explicit placement with no room anywhere also docks inset", () => {
    const r = computePosition({
      target: { top: -50, left: 0, width: 1000, height: 900 },
      popover: { width: 340, height: 220 },
      viewport: { width: 1000, height: 800 },
      placement: "left",
    });
    expect(r.placement).toBe("inset");
  });
});
