import type { IntroDocument } from "./schema";

export interface IntroLabels {
  next: string;
  back: string;
  done: string;
  skip: string;
  /** `{n}` and `{total}` are replaced. */
  stepOf: string;
  close: string;
}

export const DEFAULT_LABELS: IntroLabels = {
  next: "Next",
  back: "Back",
  done: "Done",
  skip: "Skip intro",
  stepOf: "Step {n} of {total}",
  close: "Close",
};

export type IntroEventType = "loaded" | "start" | "step" | "complete" | "skip" | "missing-target";

export interface IntroEvent {
  type: IntroEventType;
  route: string;
  stepId?: string;
  index?: number;
}

/**
 * How a tour ended. "empty" means no step could be displayed at all (every
 * target missing): the visitor saw nothing, so it must not count as seen.
 */
export type IntroCloseReason = "done" | "skip" | "empty";

export interface IntroTourEvent {
  type: "step" | "missing-target";
  stepId: string;
  /** Position among the displayable steps (step events); original position otherwise. */
  index: number;
}

export interface IntroContextValue {
  /** A usable, non-draft document exists for the current route. */
  hasIntro: boolean;
  isRunning: boolean;
  /** Normalised current route, or null when the pathname is not a legal route. */
  route: string | null;
  /** The loaded document with draft steps already removed. */
  doc: IntroDocument | null;
  start: () => void;
  /** Close the tour without recording it as seen. */
  stop: () => void;
  autoStartEnabled: boolean;
  setAutoStartEnabled: (enabled: boolean) => void;
}

export const mergeLabels = (labels?: Partial<IntroLabels>): IntroLabels => ({ ...DEFAULT_LABELS, ...labels });
