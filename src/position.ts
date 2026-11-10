/* Where the popover goes. Pure arithmetic on rectangles, so it is unit-testable
   without a layout engine. The tour measures the DOM and hands the numbers in. */

export type Side = "top" | "bottom" | "left" | "right";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ComputePositionInput {
  /** Viewport-relative rect of the spotlighted element, or null to centre. */
  target: Rect | null;
  popover: Size;
  viewport: Size;
  placement: "auto" | Side;
  /** Space between the target and the popover. */
  gap?: number;
  /** Minimum distance kept from every viewport edge. */
  margin?: number;
}

export interface PositionResult {
  top: number;
  left: number;
  /** "inset": no side had room (a target taller or wider than the viewport
   *  allows), so the popover docks at the bottom of the viewport, over the
   *  target, with no arrow. Squeezing it into the biggest gap instead put it
   *  half over a sidebar and half over the target it was describing. */
  placement: Side | "center" | "inset";
  /** Offset along the popover edge that faces the target; null when centred or inset. */
  arrow: number | null;
}

/** How far in from a popover corner the arrow may sit. */
const ARROW_INSET = 16;
const PREFERENCE: readonly Side[] = ["bottom", "top", "right", "left"];
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

const clamp = (value: number, min: number, max: number) => (max < min ? min : Math.min(Math.max(value, min), max));

export function computePosition(input: ComputePositionInput): PositionResult {
  const { target, popover, viewport, placement } = input;
  const gap = input.gap ?? 12;
  const margin = input.margin ?? 8;

  const place = (top: number, left: number): { top: number; left: number } => ({
    top: Math.round(clamp(top, margin, viewport.height - popover.height - margin)),
    left: Math.round(clamp(left, margin, viewport.width - popover.width - margin)),
  });

  if (!target) {
    const centred = place((viewport.height - popover.height) / 2, (viewport.width - popover.width) / 2);
    return { ...centred, placement: "center", arrow: null };
  }

  const space: Record<Side, number> = {
    top: target.top - margin,
    bottom: viewport.height - (target.top + target.height) - margin,
    left: target.left - margin,
    right: viewport.width - (target.left + target.width) - margin,
  };
  const needs = (side: Side) => (side === "top" || side === "bottom" ? popover.height : popover.width) + gap;
  const fits = (side: Side) => space[side] >= needs(side);

  let side: Side | undefined;
  if (placement === "auto") side = PREFERENCE.find(fits);
  else if (fits(placement)) side = placement;
  else if (fits(OPPOSITE[placement])) side = OPPOSITE[placement];
  else side = PREFERENCE.find(fits);

  if (!side) {
    // Centre on the part of the target that is actually on screen.
    const visLeft = Math.max(target.left, 0);
    const visRight = Math.min(target.left + target.width, viewport.width);
    const visCentre = visRight > visLeft ? (visLeft + visRight) / 2 : viewport.width / 2;
    const docked = place(viewport.height - popover.height - margin, visCentre - popover.width / 2);
    return { ...docked, placement: "inset", arrow: null };
  }

  const centreX = target.left + target.width / 2;
  const centreY = target.top + target.height / 2;

  let top: number;
  let left: number;
  if (side === "bottom") {
    top = target.top + target.height + gap;
    left = centreX - popover.width / 2;
  } else if (side === "top") {
    top = target.top - gap - popover.height;
    left = centreX - popover.width / 2;
  } else if (side === "right") {
    left = target.left + target.width + gap;
    top = centreY - popover.height / 2;
  } else {
    left = target.left - gap - popover.width;
    top = centreY - popover.height / 2;
  }

  const placed = place(top, left);
  const along = side === "top" || side === "bottom" ? centreX - placed.left : centreY - placed.top;
  const extent = side === "top" || side === "bottom" ? popover.width : popover.height;
  const arrow = Math.round(clamp(along, ARROW_INSET, extent - ARROW_INSET));
  return { ...placed, placement: side, arrow };
}
