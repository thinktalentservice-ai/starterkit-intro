import { useLayoutEffect } from "react";
import type { ReactElement } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IntroAutoStartSwitch } from "../IntroAutoStartSwitch";
import { IntroHelpButton } from "../IntroHelpButton";
import { IntroProvider } from "../IntroProvider";
import { DemoPage, demoDoc, memoryFetch } from "./fixtures";

/**
 * Both controls read the provider through `useIntro()`, so each story wraps
 * them in one. They are styled by the package and themed by host tokens.
 */
const withProvider = (storageKey: string, hasIntro = true) =>
  function ProviderDecorator(Story: () => ReactElement) {
    return (
      <IntroProvider pathname="/" baseUrl="/intro" autoStart={false} storageKey={storageKey} fetchIntro={memoryFetch(hasIntro ? demoDoc : null)}>
        <div className="sb-demo" style={{ minHeight: 0, padding: 24 }}>
          <div className="tools" style={{ display: "inline-flex" }}>
            <Story />
          </div>
        </div>
      </IntroProvider>
    );
  };

export default {
  title: "Components/Controls",
  parameters: { docs: { story: { iframeHeight: 140 } } },
} satisfies Meta;

export const HelpButton: StoryObj<typeof IntroHelpButton> = {
  name: "IntroHelpButton",
  render: (args) => <IntroHelpButton {...args} />,
  args: { label: "Start page intro" },
  decorators: [withProvider("sb-intro:help")],
  parameters: {
    docs: { description: { story: "Starts the tour for the current page. Disabled when the page has no intro." } },
  },
};

export const HelpButtonDisabled: StoryObj<typeof IntroHelpButton> = {
  name: "IntroHelpButton (no intro)",
  render: (args) => <IntroHelpButton {...args} />,
  decorators: [withProvider("sb-intro:help-off", false)],
};

export const AutoStartSwitch: StoryObj<typeof IntroAutoStartSwitch> = {
  name: "IntroAutoStartSwitch",
  render: (args) => <IntroAutoStartSwitch {...args} />,
  args: { label: "Show intro on new pages" },
  decorators: [withProvider("sb-intro:switch")],
  parameters: {
    docs: {
      description: {
        story: "Turns auto-start off for every page. The choice is stored under the provider's `storageKey`.",
      },
    },
  },
};

/** Not a component story: the full page with a light host theme. */
export const LightHostTheme: StoryObj = {
  name: "Recipe: light host theme",
  parameters: {
    docs: {
      story: { iframeHeight: 560 },
      description: {
        story:
          "Define the host tokens (`--surface-elevated`, `--fg1`, `--primary-solid`, …) and the tour follows them. " +
          "No package-specific selectors needed.",
      },
    },
  },
  render: () => <LightThemePage />,
};

/**
 * The tour portals into <body>, so host tokens must live on an ancestor of
 * <body> — <html>/:root, as a real host defines them — not on a wrapper div.
 */
function LightThemePage() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("sb-light-theme");
    return () => root.classList.remove("sb-light-theme");
  }, []);
  return (
    <IntroProvider pathname="/" baseUrl="/intro" autoStart={false} storageKey="sb-intro:light" fetchIntro={memoryFetch(demoDoc)}>
      <DemoPage />
    </IntroProvider>
  );
}
