import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { IntroProvider } from "../IntroProvider";
import { DemoPage, demoDoc, memoryFetch } from "./fixtures";

const meta = {
  title: "Components/IntroProvider",
  component: IntroProvider,
  parameters: {
    docs: {
      description: {
        component:
          "Loads the intro JSON for the current `pathname` from `baseUrl`, decides whether to auto-start, and renders the tour. " +
          "It knows nothing about routers: pass the pathname in. These stories inject the document through `fetchIntro` " +
          "so nothing is fetched; press the **?** button in the header to start the tour.",
      },
    },
  },
  args: {
    pathname: "/",
    baseUrl: "/intro",
    autoStart: false,
    autoStartDelay: 700,
    storageKey: "sb-intro:provider",
    fetchIntro: memoryFetch(demoDoc),
    onEvent: fn(),
  },
  argTypes: {
    children: { control: false },
    fetchIntro: { control: false },
    labels: { control: "object" },
  },
  render: (args) => (
    <IntroProvider {...args}>
      <DemoPage />
    </IntroProvider>
  ),
} satisfies Meta<typeof IntroProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Start the tour from the **?** button. Events appear in the Actions panel. */
export const Default: Story = {};

/**
 * The first visit to a revision starts the tour on its own after
 * `autoStartDelay`. The seen-state is cleared before each render here, so it
 * auto-starts every time you open this story.
 */
export const AutoStart: Story = {
  args: { autoStart: true, storageKey: "sb-intro:autostart" },
  beforeEach: () => {
    try {
      localStorage.removeItem("sb-intro:autostart");
    } catch {
      /* storage blocked: the story still renders, it just may not auto-start */
    }
  },
};

/** Every label is replaceable, for localisation or house style. */
export const CustomLabels: Story = {
  args: {
    storageKey: "sb-intro:labels",
    labels: {
      next: "Weiter",
      back: "Zurück",
      done: "Fertig",
      skip: "Überspringen",
      stepOf: "Schritt {n} von {total}",
      close: "Schließen",
    },
  },
};

/** A page with no JSON file: the provider renders nothing and the help button is disabled. */
export const NoIntroForPage: Story = {
  args: {
    pathname: "/no-intro-here",
    storageKey: "sb-intro:none",
    fetchIntro: memoryFetch(null),
  },
};
