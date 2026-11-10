import type { ReactNode } from "react";
import { IntroAutoStartSwitch } from "../IntroAutoStartSwitch";
import { IntroHelpButton } from "../IntroHelpButton";
import type { IntroDocument, IntroStep } from "../schema";

/**
 * The stories never touch the network: GitHub Pages serves this workshop from a
 * sub-path, and a relative fetch would resolve differently in the manager, the
 * docs iframes and the canvas. `fetchIntro` is the provider's own seam for
 * exactly this, so the stories use it.
 */
export const memoryFetch =
  (doc: IntroDocument | null) =>
  async (): Promise<unknown> =>
    doc;

export const demoSteps: IntroStep[] = [
  {
    id: "welcome",
    title: "Welcome to the demo",
    body: "This short tour shows what is on the page. Use the arrow keys or the buttons to move.",
  },
  {
    id: "hero",
    target: '[data-intro="hero"]',
    title: "The hero",
    body: "Each step can point at any element with a CSS selector.",
    placement: "bottom",
  },
  {
    id: "features",
    target: '[data-intro="features"]',
    title: "Features",
    body: "The page scrolls to the target and the spotlight follows it.",
  },
  {
    id: "alerts",
    target: '[data-intro="alerts"]',
    title: "Alerts",
    body: "This button sits against the right edge; the popover stays inside the viewport.",
    placement: "left",
  },
  {
    id: "not-on-this-page",
    target: '[data-intro="does-not-exist"]',
    title: "Not here",
    body: "A step whose target is missing is skipped without a warning when it is optional.",
    optional: true,
  },
  {
    id: "settings",
    target: '[data-intro="settings"]',
    title: "Settings",
    body: "The last step. Press Done to finish; it will not start on its own again.",
  },
];

export const demoDoc: IntroDocument = {
  schema: 1,
  route: "/",
  revision: 1,
  title: "Demo page",
  steps: demoSteps,
};

export interface DemoPageProps {
  /** Render the help button and auto-start switch in the header. */
  tools?: boolean;
  /** Extra header content, e.g. a launcher for the bare IntroTour. */
  actions?: ReactNode;
  className?: string;
}

/** A small app page whose sections carry `data-intro` markers. */
export function DemoPage({ tools = true, actions, className }: DemoPageProps) {
  return (
    <div className={className ? `sb-demo ${className}` : "sb-demo"}>
      <header>
        <h1>Acme dashboard</h1>
        {actions}
        {tools && (
          <div className="tools">
            <IntroAutoStartSwitch />
            <IntroHelpButton />
          </div>
        )}
        <button type="button" className="alerts" data-intro="alerts">
          Alerts
        </button>
      </header>
      <main>
        <section data-intro="hero">
          <h2>Hero</h2>
          <p>The first thing visitors see.</p>
        </section>
        <section data-intro="features">
          <h2>Features</h2>
          <p>What the product does.</p>
        </section>
        <section data-intro="pricing">
          <h2>Pricing</h2>
          <p>What it costs.</p>
        </section>
        <section data-intro="settings">
          <h2>Settings</h2>
          <p>Where the knobs are.</p>
        </section>
      </main>
    </div>
  );
}
