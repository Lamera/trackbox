import { describe, expect, it } from "vitest";

import { heardPadFx, padFxFor, pressPad, releasePad } from "./padFx";

describe("padFx", () => {
  it("maps both PAD FX banks and nothing else", () => {
    expect(padFxFor("padFx1", 0)).toEqual({ kind: "echo", beats: 0.25 });
    expect(padFxFor("padFx1", 5)).toEqual({ kind: "reverb", beats: 4 });
    expect(padFxFor("padFx1", 7)).toEqual({ kind: "trans", beats: 0.125 });
    expect(padFxFor("padFx2", 0)).toEqual({ kind: "roll", beats: 1 / 16 });
    expect(padFxFor("padFx2", 6)).toEqual({ kind: "lpf", beats: 2 });
    expect(padFxFor("padFx2", 7)).toEqual({ kind: "crush", beats: 1 });
    expect(padFxFor("padFx2", 8)).toBeNull();
    expect(padFxFor("hotCue", 0)).toBeNull();
  });

  it("plays the last pressed pad and falls back to one still held", () => {
    const echo = padFxFor("padFx1", 0)!;
    const roll = padFxFor("padFx2", 2)!;
    let held = pressPad([], 0, echo);
    held = pressPad(held, 2, roll);
    expect(heardPadFx(held)).toBe(roll);
    // Letting go of the one not heard changes nothing.
    const before = heardPadFx(held);
    held = releasePad(held, 0);
    expect(heardPadFx(held)).toBe(before);
    held = pressPad(held, 0, echo);
    expect(heardPadFx(held)).toBe(echo);
    held = releasePad(held, 0);
    expect(heardPadFx(held)).toBe(roll);
    held = releasePad(held, 2);
    expect(heardPadFx(held)).toBeNull();
    expect(releasePad(held, 5)).toEqual([]);
  });
});
