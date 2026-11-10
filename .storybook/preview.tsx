import type { Preview } from "@storybook/react-vite";
import "../styles.css";
import "./preview.css";

const preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    docs: {
      toc: true,
      // The tour portals a full-viewport scrim into <body>. Inline in a docs
      // page that would cover the whole docs site, so every story renders in
      // its own iframe and the overlay stays inside the frame.
      story: { inline: false, iframeHeight: 560 },
    },
    options: {
      storySort: {
        order: ["Introduction", "Components", ["IntroProvider", "IntroTour", "Controls"]],
      },
    },
  },
  tags: ["autodocs"],
} satisfies Preview;

export default preview;
