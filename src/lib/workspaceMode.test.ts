import { describe, expect, it } from "vitest";
import { asWorkspaceMode, asWaveformOrientation, layoutForWorkspace, readExportLayout, waveformAxis, waveformPointerDelta } from "./workspaceMode";

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

describe("performance waveform orientation", () => {
  it("rejects invalid preferences and defaults to horizontal", () => {
    expect(asWaveformOrientation("vertical")).toBe("vertical");
    for (const value of ["", "sideways", undefined, null, 123]) {
      expect(asWaveformOrientation(value)).toBe("horizontal");
    }
  });
  it("projects the timeline axis and drag without changing source time", () => {
    const size = { width: 640, height: 240 };
    expect(waveformAxis(size, "horizontal")).toEqual({ length: 640, breadth: 240 });
    expect(waveformAxis(size, "vertical")).toEqual({ length: 240, breadth: 640 });
    const from = { x: 100, y: 100 }, to = { x: 128, y: 150 };
    expect(waveformPointerDelta(to, from, "horizontal")).toBe(28);
    expect(waveformPointerDelta(to, from, "vertical")).toBe(50);
  });
});
