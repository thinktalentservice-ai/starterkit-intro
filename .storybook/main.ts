import type { StorybookConfig } from "@storybook/react-vite";

const config = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: "@storybook/react-vite",
  docs: {
    autodocs: "tag",
  },
} satisfies StorybookConfig;

export default config;
