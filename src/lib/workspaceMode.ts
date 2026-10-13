/**
 * Trackbox's two DJ workflows. PERFORMANCE deliberately composes the existing
 * two-player engine; it does not replace EXPORT's layouts or persisted session.
 */
import { LAYOUTS, type PlayerLayout } from "./layout";

export type WorkspaceMode = "export" | "performance";
export type WaveformOrientation = "horizontal" | "vertical";

/** Independent of the workspace choice and never used for EXPORT. */
export const PERFORMANCE_WAVEFORM_KEY = "trackbox.workspace.performanceWaveform";

export function asWaveformOrientation(value: unknown): WaveformOrientation {
  return value === "vertical" ? "vertical" : "horizontal";
}

/** The timeline remains left-to-right in local coordinates, even when rotated
 * 90 degrees clockwise so upcoming audio approaches from the bottom. */
export function waveformAxis(size: { width: number; height: number }, orientation: WaveformOrientation) {
  return orientation === "vertical"
    ? { length: size.height, breadth: size.width }
    : { length: size.width, breadth: size.height };
}

export function waveformPointerDelta(
  current: { x: number; y: number },
  origin: { x: number; y: number },
  orientation: WaveformOrientation,
) {
  return orientation === "vertical" ? current.y - origin.y : current.x - origin.x;
}


export const WORKSPACE_MODE_KEY = "trackbox.workspace.mode";
export const EXPORT_LAYOUT_KEY = "trackbox.workspace.exportLayout";

export function asWorkspaceMode(value: unknown): WorkspaceMode {
  return value === "performance" ? "performance" : "export";
}

export function readExportLayout(value: unknown, fallback: PlayerLayout): PlayerLayout {
  return LAYOUTS.some((entry) => entry.id === value) ? value as PlayerLayout : fallback;
}

export function layoutForWorkspace(mode: WorkspaceMode, exportLayout: PlayerLayout): PlayerLayout {
  return mode === "performance" ? "two" : exportLayout;
}
