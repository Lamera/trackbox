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

test("performance channel faders and EQ are real keyboard-operable controls", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("workspace-mode-performance").click();
  const volumeA = page.getByRole("slider", { name: "Deck A channel volume" });
  const volumeB = page.getByRole("slider", { name: "Deck B channel volume" });
  const highA = page.getByRole("slider", { name: "Deck A HIGH EQ" });
  await expect(volumeA).toHaveValue("1");
  await expect(volumeB).toHaveValue("1");
  await expect(highA).toHaveValue("0.5");
  await volumeA.focus();
  await volumeA.press("ArrowLeft");
  await expect(volumeA).toHaveValue("0.99");
  await highA.focus();
  await highA.press("ArrowRight");
  await expect(highA).toHaveValue("0.51");
  await highA.dblclick();
  await expect(highA).toHaveValue("0.5");
  await page.getByRole("button", { name: "ISOLATOR", exact: true }).click();
  await expect(page.getByRole("button", { name: "ISOLATOR", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("workspace-mode-export").click();
  await expect(page.getByRole("slider", { name: "Deck A channel volume" })).toHaveCount(0);
  await expect(page.getByTestId("body")).toBeVisible();
});
