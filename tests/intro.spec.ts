import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/* jsdom cannot lay anything out, so these run the demo in a real browser:
   where the spotlight lands, whether the popover stays on screen, and what a
   reload remembers. The demo's intro file is demo/public/intro/index.json. */

const popover = (page: Page) => page.locator(".ii-popover[data-ready]");
const spotlight = (page: Page) => page.locator(".ii-spotlight");
const help = (page: Page) => page.getByRole("button", { name: "Start page intro" });
const sw = (page: Page) => page.getByRole("switch", { name: "Show intro on new pages" });

/** Wait for the intro file to load (the help button enables), then give an auto-start time to NOT happen. */
async function expectNoAutoStart(page: Page) {
  await expect(help(page)).toBeEnabled();
  await page.waitForTimeout(1500);
  await expect(page.locator(".ii-layer")).toHaveCount(0);
}

test("auto-starts on the first visit, with focus on the primary button", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  await expect(popover(page).locator(".ii-title")).toHaveText("Welcome to the demo");
  await expect(popover(page).locator(".ii-progress")).toHaveText("Step 1 of 5");
  await expect(page.locator(".ii-btn--primary")).toBeFocused();
  // Target-less first step: a scrim, no spotlight.
  await expect(page.locator(".ii-scrim")).toBeVisible();
  await expect(spotlight(page)).toHaveCount(0);
});

test("Next moves the spotlight onto the target's rect", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(popover(page).locator(".ii-title")).toHaveText("The hero");

  const hero = page.locator('[data-intro="hero"]');
  await expect
    .poll(async () => {
      const [spot, target] = await Promise.all([spotlight(page).boundingBox(), hero.boundingBox()]);
      if (!spot || !target) return null;
      // 6px of padding on every side.
      return [spot.x - target.x, spot.y - target.y, spot.width - target.width, spot.height - target.height].map(Math.round);
    })
    .toEqual([-6, -6, 12, 12]);

  // A second hop scrolls: the spotlight must follow the element, not the old position.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(popover(page).locator(".ii-title")).toHaveText("Features");
  const features = page.locator('[data-intro="features"]');
  await expect
    .poll(async () => {
      const [spot, target] = await Promise.all([spotlight(page).boundingBox(), features.boundingBox()]);
      if (!spot || !target) return null;
      return [spot.x - target.x, spot.y - target.y].map(Math.round);
    })
    .toEqual([-6, -6]);
});

test("the scrim blocks the page and a click on it does not end the tour", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(popover(page)).toBeVisible();
  const hit = await page.evaluate(() => document.elementFromPoint(4, 4)?.className);
  expect(hit).toContain("ii-blocker");
});

test("an optional step with a missing target is skipped without a gap in the count", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect(popover(page).locator(".ii-title")).toHaveText("Alerts");
  await expect(popover(page).locator(".ii-progress")).toHaveText("Step 4 of 5");
  await page.keyboard.press("ArrowRight");
  await expect(popover(page).locator(".ii-title")).toHaveText("Settings");
  await expect(popover(page).locator(".ii-progress")).toHaveText("Step 5 of 5");
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  expect(warnings.filter((w) => w.includes("starterkit-intro"))).toEqual([]);
});

test("Esc closes the tour and a reload does not start it again", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".ii-layer")).toHaveCount(0);
  await page.reload();
  await expectNoAutoStart(page);
});

test("finishing with Done is remembered too", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^(Next|Done)$/ }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".ii-layer")).toHaveCount(0);
  await page.reload();
  await expectNoAutoStart(page);
});

test("the help button replays the tour, and focus returns to it afterwards", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".ii-layer")).toHaveCount(0);

  await help(page).click();
  await expect(popover(page).locator(".ii-title")).toHaveText("Welcome to the demo");
  await page.keyboard.press("Escape");
  await expect(page.locator(".ii-layer")).toHaveCount(0);
  await expect(help(page)).toBeFocused();
});

test("turning the switch off persists, and stops auto-start even for an unseen revision", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");

  // Forget that the tour was seen, so only the switch can be what holds it back.
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("starterkit-intro")!);
    state.seen = {};
    localStorage.setItem("starterkit-intro", JSON.stringify(state));
  });
  await page.reload();
  await expectNoAutoStart(page);
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
});

test("Tab stays trapped inside the popover", async ({ page }) => {
  await page.goto("/");
  await expect(popover(page)).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => !!document.activeElement?.closest(".ii-popover"));
    expect(inside).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest(".ii-popover"))).toBe(true);
});

for (const size of [
  { width: 1280, height: 800 },
  { width: 420, height: 720 },
]) {
  test(`the popover stays inside a ${size.width}px viewport for the right-edge target`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(popover(page)).toBeVisible();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await expect(popover(page).locator(".ii-title")).toHaveText("Alerts");

    await expect
      .poll(async () => {
        const box = await popover(page).boundingBox();
        if (!box) return false;
        return box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height;
      })
      .toBe(true);

    // And it is still next to its target, not centred in the page.
    const [box, target] = await Promise.all([popover(page).boundingBox(), page.locator('[data-intro="alerts"]').boundingBox()]);
    expect(box && target).toBeTruthy();
    const gap = Math.min(Math.abs(box!.y - (target!.y + target!.height)), Math.abs(target!.x - (box!.x + box!.width)));
    expect(gap).toBeLessThan(40);
  });
}
