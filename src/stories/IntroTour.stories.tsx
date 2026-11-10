import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { IntroTour } from "../IntroTour";
import type { IntroTourProps } from "../IntroTour";
import type { IntroCloseReason } from "../types";
import type { IntroPlacement } from "../schema";
import { DemoPage, demoSteps } from "./fixtures";

/**
 * IntroTour is the bare engine the provider renders. It has no open/closed
 * prop — mounting it starts the tour — so the harness mounts it on demand.
 */
function TourHarness(props: IntroTourProps) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<IntroCloseReason | null>(null);
  return (
    <>
      <DemoPage
        tools={false}
        actions={
          <>
            {last && <p className="status">Last close: {last}</p>}
            <button type="button" className="launch" onClick={() => setOpen(true)}>
              Start tour
            </button>
          </>
        }
      />
      {open && (
        <IntroTour
          {...props}
          onClose={(reason) => {
            props.onClose(reason);
            setLast(reason);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

const meta = {
  title: "Components/IntroTour",
  component: IntroTour,
  parameters: {
    docs: {
      description: {
        component:
          "The tour engine on its own: a scrim, a spotlight on the target and a positioned popover. " +
          "Use it directly only when you manage loading and seen-state yourself; otherwise use `IntroProvider`. " +
          "Press **Start tour** in each preview.",
      },
    },
  },
  args: {
    steps: demoSteps,
    onClose: fn(),
    onEvent: fn(),
  },
  render: (args) => <TourHarness {...args} />,
} satisfies Meta<typeof IntroTour>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A step without `target` is centred with no spotlight. */
export const CentredOnly: Story = {
  args: {
    steps: [
      { id: "hello", title: "Hello", body: "No target, so the popover sits in the middle of the viewport." },
      { id: "bye", title: "That's it", body: "Two centred steps make a lightweight announcement." },
    ],
  },
};

const placement = (p: IntroPlacement) => ({
  id: `place-${p}`,
  target: '[data-intro="features"]',
  title: `placement: "${p}"`,
  body: "The preferred side. If it does not fit, the engine flips and clamps inside the viewport.",
  placement: p,
});

/** Each step points at the same section with a different preferred `placement`. */
export const Placements: Story = {
  args: {
    steps: (["top", "right", "bottom", "left", "auto"] as const).map(placement),
  },
};

/**
 * A required step whose target is missing is skipped with a console warning
 * and a `missing-target` event; if nothing can be shown the tour closes with "empty".
 */
export const MissingTargets: Story = {
  args: {
    steps: [
      { id: "ghost", target: '[data-intro="nope"]', title: "Ghost", body: "Never shown." },
      { id: "hero", target: '[data-intro="hero"]', title: "The hero", body: "The missing step before this one was skipped." },
    ],
  },
};
