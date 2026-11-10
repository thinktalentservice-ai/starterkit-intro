import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { computePosition } from "./position";
import type { PositionResult, Rect } from "./position";
import type { IntroStep } from "./schema";
import { mergeLabels } from "./types";
import type { IntroCloseReason, IntroLabels, IntroTourEvent } from "./types";

export interface IntroTourProps {
  /** Steps to walk through, in order. Draft filtering is the caller's job. */
  steps: IntroStep[];
  /**
   * Called once when the tour ends. "done" = last step finished; "skip" = Skip,
   * Esc or the close button; "empty" = no step could be displayed at all.
   */
  onClose: (reason: IntroCloseReason) => void;
  labels?: Partial<IntroLabels>;
  /** "step" when a step is shown, "missing-target" when a step is skipped. */
  onEvent?: (event: IntroTourEvent) => void;
}

interface Geometry {
  spot: Rect | null;
  pos: PositionResult;
}

/** Breathing room between the target and the edge of its spotlight. */
const SPOT_PAD = 6;
const TAG = "[starterkit-intro]";

// useLayoutEffect warns during SSR on React 18. This component is client-only in
// practice, but it is exported, so don't hand a host that warning.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Found = { el: Element | null; invalid: boolean };

/** A target counts only if a person could actually see it. */
function findTarget(selector: string): Found {
  let el: Element | null;
  try {
    el = document.querySelector(selector);
  } catch {
    return { el: null, invalid: true };
  }
  if (!el || !el.isConnected) return { el: null, invalid: false };
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { el: null, invalid: false };
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return { el: null, invalid: false };
  return { el, invalid: false };
}

interface Missed {
  step: IntroStep;
  index: number;
  invalid: boolean;
}

function resolveSteps(steps: IntroStep[]): { list: IntroStep[]; missed: Missed[] } {
  if (typeof document === "undefined") return { list: [], missed: [] };
  const list: IntroStep[] = [];
  const missed: Missed[] = [];
  steps.forEach((step, index) => {
    if (!step.target) {
      list.push(step);
      return;
    }
    const found = findTarget(step.target);
    if (found.el) list.push(step);
    else missed.push({ step, index, invalid: found.invalid });
  });
  return { list, missed };
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function IntroTour({ steps, onClose, labels: labelsProp, onEvent }: IntroTourProps) {
  const labels = mergeLabels(labelsProp);
  const [resolved] = useState(() => resolveSteps(steps));
  const list = resolved.list;

  const [index, setIndex] = useState(0);
  const [geom, setGeom] = useState<Geometry | null>(null);

  const titleId = useId();
  const bodyId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef<Element | null>(null);
  const indexRef = useRef(0);
  const dirRef = useRef<1 | -1>(1);
  const reportedRef = useRef(false);
  const emittedRef = useRef(-1);
  const onCloseRef = useRef(onClose);
  const onEventRef = useRef(onEvent);
  useIsoLayoutEffect(() => {
    onCloseRef.current = onClose;
    onEventRef.current = onEvent;
  });

  const finish = useCallback((reason: IntroCloseReason) => onCloseRef.current(reason), []);

  const reportMissing = useCallback((step: IntroStep, at: number, invalid: boolean) => {
    if (invalid) console.warn(`${TAG} step "${step.id}" skipped: invalid selector ${JSON.stringify(step.target)}`);
    if (step.optional && !invalid) return;
    if (!invalid) console.warn(`${TAG} step "${step.id}" skipped: target ${JSON.stringify(step.target)} not found or not visible`);
    onEventRef.current?.({ type: "missing-target", stepId: step.id, index: at });
  }, []);

  /** Move to the next displayable step in `dir`. False when there is none behind. */
  const go = useCallback(
    (dir: 1 | -1): boolean => {
      dirRef.current = dir;
      let i = indexRef.current + dir;
      while (i >= 0 && i < list.length) {
        const step = list[i]!;
        if (!step.target) break;
        const found = findTarget(step.target);
        if (found.el) break;
        reportMissing(step, i, found.invalid);
        i += dir;
      }
      if (i >= list.length) {
        finish("done");
        return true;
      }
      if (i < 0) return false;
      indexRef.current = i;
      setIndex(i);
      return true;
    },
    [list, finish, reportMissing],
  );

  // Steps dropped before the tour opened: report them once, and bail if nothing is left.
  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    for (const m of resolved.missed) reportMissing(m.step, m.index, m.invalid);
    if (list.length === 0) finish("empty");
  }, [resolved, list, reportMissing, finish]);

  // Where focus was before the tour opened, so Done / Skip / Esc hand it back.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => {
      if (previous && previous !== document.body && previous.isConnected && typeof previous.focus === "function") {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  const step = list[index];

  useEffect(() => {
    if (!step || emittedRef.current === index) return;
    emittedRef.current = index;
    onEventRef.current?.({ type: "step", stepId: step.id, index });
  }, [step, index]);

  // Scroll to the target, then keep the spotlight and popover glued to it.
  useIsoLayoutEffect(() => {
    if (!step) return;
    let el: Element | null = null;
    if (step.target) {
      const found = findTarget(step.target);
      if (!found.el) {
        // Gone since the last check: skip in the direction of travel.
        reportMissing(step, index, found.invalid);
        if (!go(dirRef.current)) go(1);
        return;
      }
      el = found.el;
    }
    targetRef.current = el;
    if (el && typeof el.scrollIntoView === "function") {
      // A smooth scroll already in flight (rapid Next / arrow presses) swallows
      // the next smooth scrollIntoView in Chromium and leaves the page stranded
      // short of the target. Pinning the scroll position cancels it first.
      window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: "auto" });
      // A target taller than most of the viewport cannot be centred whole;
      // "center" would cut off its top, which is where its heading is.
      const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
      el.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }

    const measure = () => {
      const popover = popoverRef.current;
      if (!popover) return;
      let spot: Rect | null = null;
      if (el) {
        if (!el.isConnected) return;
        const r = el.getBoundingClientRect();
        spot = { top: r.top - SPOT_PAD, left: r.left - SPOT_PAD, width: r.width + SPOT_PAD * 2, height: r.height + SPOT_PAD * 2 };
      }
      const root = document.documentElement;
      const pos = computePosition({
        target: spot,
        popover: { width: popover.offsetWidth, height: popover.offsetHeight },
        viewport: { width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight },
        placement: step.placement ?? "auto",
      });
      setGeom((prev) =>
        prev && sameRect(prev.spot, spot) && prev.pos.top === pos.top && prev.pos.left === pos.left && prev.pos.placement === pos.placement && prev.pos.arrow === pos.arrow
          ? prev
          : { spot, pos },
      );
    };

    measure();
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (el) observer?.observe(el);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      observer?.disconnect();
    };
  }, [step, index, go, reportMissing]);

  // Focus the primary button once the popover is visible, and pull it back in
  // if a step change unmounted whatever held it (the Back button on step one).
  const ready = geom !== null;
  useEffect(() => {
    if (!ready) return;
    const popover = popoverRef.current;
    if (popover && !popover.contains(document.activeElement)) primaryRef.current?.focus({ preventScroll: true });
  }, [ready, index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish("skip");
      } else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        go(event.key === "ArrowRight" ? 1 : -1);
      } else if (event.key === "Tab") {
        const popover = popoverRef.current;
        if (!popover) return;
        const focusable = Array.from(popover.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        const inside = !!active && popover.contains(active);
        if (event.shiftKey && (!inside || active === first)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (!inside || active === last)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [go, finish]);

  if (typeof document === "undefined" || !step) return null;

  const isFirst = index === 0;
  const isLast = index === list.length - 1;
  const pos = geom?.pos;
  const progress = labels.stepOf.replace("{n}", String(index + 1)).replace("{total}", String(list.length));
  const popoverStyle: CSSProperties = { top: pos?.top ?? 0, left: pos?.left ?? 0 };
  const arrowStyle = (pos?.arrow != null ? { "--ii-arrow": `${pos.arrow}px` } : undefined) as CSSProperties | undefined;

  return createPortal(
    <div className="ii-layer">
      <div className="ii-blocker" aria-hidden="true" />
      {step.target ? (
        geom?.spot && (
          <div
            className="ii-spotlight"
            aria-hidden="true"
            style={{ top: geom.spot.top, left: geom.spot.left, width: geom.spot.width, height: geom.spot.height }}
          />
        )
      ) : (
        <div className="ii-scrim" aria-hidden="true" />
      )}
      <div
        ref={popoverRef}
        className="ii-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-placement={pos?.placement ?? "center"}
        data-ready={ready ? "" : undefined}
        style={popoverStyle}
      >
        {pos && pos.arrow != null && pos.placement !== "center" && (
          <span className="ii-arrow" data-placement={pos.placement} style={arrowStyle} aria-hidden="true" />
        )}
        <button type="button" className="ii-close" aria-label={labels.close} onClick={() => finish("skip")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id={titleId} className="ii-title">
          {step.title}
        </h2>
        <p id={bodyId} className="ii-body">
          {step.body}
        </p>
        <div className="ii-footer">
          <span className="ii-progress" aria-live="polite">
            {progress}
          </span>
          <div className="ii-actions">
            <button type="button" className="ii-btn ii-btn--ghost" onClick={() => finish("skip")}>
              {labels.skip}
            </button>
            {!isFirst && (
              <button type="button" className="ii-btn ii-btn--ghost" onClick={() => go(-1)}>
                {labels.back}
              </button>
            )}
            <button ref={primaryRef} type="button" className="ii-btn ii-btn--primary" onClick={() => go(1)}>
              {isLast ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
