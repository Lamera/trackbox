/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import { PreferencesProvider } from "@/store/usePreferences";
import { MixerStrip } from "./MixerStrip";

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean; }

const setChannelKill = vi.fn(() => Promise.resolve());
const setChannelBand = vi.fn(() => Promise.resolve());
const setChannelVolume = vi.fn(() => Promise.resolve());
const setEqCurve = vi.fn(() => Promise.resolve());
vi.mock("@/ipc/client", () => ({
  getBackend: () => Promise.resolve({
    setChannelKill, setChannelBand, setChannelVolume, setEqCurve,
    setChannelTrim: () => Promise.resolve(), setCrossfade: () => Promise.resolve(),
  }),
}));

let host: HTMLDivElement;
let root: Root;

function mount(overrides: Record<string, { key: string; shiftKey?: boolean }>, performance = false) {
  const preferences = { ...DEFAULT_PREFERENCES, keyboard: { ...DEFAULT_PREFERENCES.keyboard, overrides } };
  act(() => root.render(
    <PreferencesProvider value={{ preferences, update: vi.fn(), reset: vi.fn() }}>
      <MixerStrip performance={performance} />
    </PreferencesProvider>,
  ));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  setChannelKill.mockClear();
  setChannelBand.mockClear();
  setChannelVolume.mockClear();
  setEqCurve.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

const press = (init: KeyboardEventInit) =>
  act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init })); });

it("toggles the assigned deck's band kill from the keyboard", async () => {
  mount({ "a.eqKillLow": { key: "z" }, "b.eqKillHigh": { key: "u" } });
  press({ key: "z" });
  await act(async () => {});
  expect(setChannelKill).toHaveBeenCalledWith("a", "low", true);
  press({ key: "z" });
  await act(async () => {});
  expect(setChannelKill).toHaveBeenLastCalledWith("a", "low", false);
  press({ key: "u" });
  await act(async () => {});
  expect(setChannelKill).toHaveBeenLastCalledWith("b", "high", true);
});

it("does nothing while the kill keys are unbound", async () => {
  mount({});
  press({ key: "z" });
  await act(async () => {});
  expect(setChannelKill).not.toHaveBeenCalled();
});

it("exposes actual post-EQ channel faders and neutral 3-band EQ only in PERFORMANCE", async () => {
  mount({}, true);
  const left = host.querySelector<HTMLInputElement>('input[aria-label="Deck A channel volume"]');
  const right = host.querySelector<HTMLInputElement>('input[aria-label="Deck B channel volume"]');
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  expect(left?.value).toBe("1");
  const high = host.querySelector<HTMLInputElement>('input[aria-label="Deck A HIGH EQ"]');
  const low = host.querySelector<HTMLInputElement>('input[aria-label="Deck B LOW EQ"]');
  expect(high?.value).toBe("0.5");
  expect(low?.value).toBe("0.5");

  act(() => {
    high?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    left?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await act(async () => {});
  expect(setChannelBand).toHaveBeenCalledWith("a", "high", 0.5);
  expect(setChannelVolume).toHaveBeenCalledWith("a", 1);

  const isolator = [...host.querySelectorAll("button")].find((button) => button.textContent === "ISOLATOR");
  act(() => isolator?.click());
  await act(async () => {});
  expect(setEqCurve).toHaveBeenCalledWith(true);
});

it("keeps the measured EXPORT mixer compact and without PERFORMANCE-only controls", () => {
  mount({});
  expect(host.querySelector('[data-performance]')).toBeNull();
  expect(host.querySelector('input[aria-label="Deck A channel volume"]')).toBeNull();
  expect(host.querySelector('input[aria-label="Deck B LOW EQ"]')).toBeNull();
});
