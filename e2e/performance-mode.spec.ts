import { expect, test } from "@playwright/test";

test("PERFORMANCE reuses the two existing decks and restores EXPORT without a page navigation", async ({ page }) => {
  await page.goto("/");

  const exportMode = page.getByTestId("workspace-mode-export");
  const performanceMode = page.getByTestId("workspace-mode-performance");

  await expect(exportMode).toHaveAttribute("aria-pressed", "true");
  await performanceMode.click();
  await expect(performanceMode).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("player-head-row")).toHaveCount(2);
  await expect(page.getByTestId("body")).toBeVisible();

  // Mode preferences survive reloads; the existing player engine is shared.
  await page.reload();
  await expect(page.getByTestId("workspace-mode-performance")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("player-head-row")).toHaveCount(2);

  await page.getByTestId("workspace-mode-export").click();
  await expect(page.getByTestId("workspace-mode-export")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("player-head-row")).toHaveCount(0);
  await expect(page.getByTestId("body")).toBeVisible();
});

test("performance vertical timeline is switchable and persists over reload", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("workspace-mode-performance").click();
  const vertical = page.getByTestId("waveform-orientation-vertical");
  await vertical.click();
  await expect(vertical).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("player-detail")).toHaveCount(2);
  await expect(page.getByTestId("player-detail").first()).toHaveAttribute("data-orientation", "vertical");
  await expect(page.locator('[data-mixer][data-orientation="vertical"]')).toBeVisible();
  await expect(page.getByTestId("body")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("waveform-orientation-vertical")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("player-detail").nth(1)).toHaveAttribute("data-orientation", "vertical");
  await page.getByTestId("waveform-orientation-horizontal").click();
  await expect(page.getByTestId("player-detail").first()).toHaveAttribute("data-orientation", "horizontal");
});
