import { defineConfig, devices } from "@playwright/test";

/* jsdom has no layout engine: every rect it reports is zero. Whether the
   spotlight lands on its target and the popover stays inside the viewport are
   real-browser questions, and tests/ is where they get asked. */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:5181",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite",
    url: "http://localhost:5181",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
