/**
 * Trackbox's two DJ workflows. PERFORMANCE deliberately composes the existing
 * two-player engine; it does not replace EXPORT's layouts or persisted session.
 */
import { LAYOUTS, type PlayerLayout } from "./layout";

export type WorkspaceMode = "export" | "performance";

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
