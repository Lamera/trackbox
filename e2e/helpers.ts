import type { Page } from "@playwright/test";

/**
 * Tooltips default off; some assertions need the real text a hover shows.
 * Must run before the page navigates — it seeds the preference the same way
 * `grid-edit.spec.ts` does, rather than clicking through Settings each time.
 */
export async function enableTooltips(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("rbl.preferences", JSON.stringify({ view: { tooltips: true } })));
}


/**
 * The app maps Command on macOS to Control on Linux/Windows.
 * Playwright's keyboard events must use the same platform modifier.
 */
export async function pressPrimary(page: Page, shortcut: string): Promise<void> {
  const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
  await page.keyboard.press(`${mac ? "Meta" : "Control"}+${shortcut}`);
}
