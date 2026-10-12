import { describe, expect, it } from "vitest";
import { asWorkspaceMode, layoutForWorkspace, readExportLayout } from "./workspaceMode";

describe("Trackbox workspace mode", () => {
  it("accepts only the two supported modes, with a safe export fallback", () => {
    expect(asWorkspaceMode("performance")).toBe("performance");
    for (const invalid of ["", "PERFORMANCE", "vertical", null, undefined, 1]) {
      expect(asWorkspaceMode(invalid)).toBe("export");
    }
  });
  it("renders both existing decks in performance mode without changing export layouts", () => {
    for (const layout of ["one", "two", "simple", "browser"] as const) {
      expect(layoutForWorkspace("export", layout)).toBe(layout);
      expect(layoutForWorkspace("performance", layout)).toBe("two");
    }
  });
  it("restores valid export layouts after entering performance mode", () => {
    expect(readExportLayout("browser", "one")).toBe("browser");
    expect(readExportLayout("simple", "one")).toBe("simple");
    expect(readExportLayout("malformed", "one")).toBe("one");
    expect(readExportLayout(null, "two")).toBe("two");
  });
});
