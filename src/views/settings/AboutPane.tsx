/**
 * About: what this is, which version, who made it, and under what terms.
 * Not a pane rekordbox has — its version is under the application menu.
 *
 * A check runs here rather than asking the main window for one, because
 * this pane may be a window of its own with no main window's state to read.
 * Its result, and any download's progress — this pane's own or one an
 * automatic check is running silently elsewhere — are shown in place.
 */
import { useEffect, useState } from "react";
import { Github, Globe, Heart } from "lucide-react";

import { getBackend } from "@/ipc/client";
import type { UpdateProgress } from "@/ipc/types";
import { formatBytes } from "@/lib/changelog";
import { usePreferencesContext } from "@/store/usePreferences";
import layout from "./PaneLayout.module.css";
import styles from "./Preferences.module.css";
import { Button, Select, Toggle } from "./controls";
import { useTranslation } from "@/i18n";

/** Where a check this pane made itself has got to. */
type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "upToDate"; version: string }
  | { kind: "store" }
  | { kind: "available"; version: string }
  | { kind: "ready"; version: string };

/** Where the links go. */
export const ABOUT_LINKS = [
  { label: "Trackbox GitHub", Icon: Github, url: "https://github.com/dme86/trackbox" },
  { label: "RBXport website", Icon: Globe, url: "https://rbxport.com" },
];

const SUPPORT_URL = "https://www.paypal.com/donate/?hosted_button_id=H6GGU8PHP8CJE";

export function AboutPane() {
  const t = useTranslation();
  const { preferences, update } = usePreferencesContext();
  const { checkUpdates, updateFrequency } = preferences.advanced;
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: "idle" });
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  // A download's progress, whoever started it: an automatic check running
  // silently in the main window counts just as much as one from here.
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    let live = true;
    // The automatic updater may have finished before About was opened. Its
    // completed download is held by the backend, including in a separate
    // Preferences window, so show it without another network check.
    void getBackend()
      .then((backend) => backend.readyUpdate())
      .then((ready) => {
        if (live && ready) setUpdateStatus((current) => current.kind === "idle"
          ? { kind: "ready", version: ready.version }
          : current);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    let stop: (() => void) | undefined;
    void getBackend().then((backend) => {
      if (!live) return;
      stop = backend.onUpdateProgress((next) => {
        if (live) setProgress(next);
      });
    });
    return () => {
      live = false;
      stop?.();
    };
  }, []);

  useEffect(() => {
    let live = true;
    void getBackend()
      .then((backend) => backend.appVersion())
      .then((found) => {
        if (live) setVersion(found);
      })
      .catch(() => {
        // A build with no shell behind it has no version to give; the pane
        // shows a dash rather than an error nobody asked about.
      });
    return () => {
      live = false;
    };
  }, []);

  const open = (url: string) => {
    void getBackend().then((backend) => backend.openUrl(url)).catch(() => {});
  };

  const checkForUpdates = () => {
    setUpdateStatus({ kind: "checking" });
    setUpdateError(null);
    void (async () => {
      try {
        const backend = await getBackend();
        const found = await backend.checkForUpdate();
        if (found.storeInstall) {
          setUpdateStatus({ kind: "store" });
        } else if (found.version === null) {
          setUpdateStatus({ kind: "upToDate", version: found.currentVersion });
        } else if (found.ready) {
          setUpdateStatus({ kind: "ready", version: found.version });
        } else {
          setUpdateStatus({ kind: "available", version: found.version });
          // An update found is taken without asking, as any check's is; this
          // pane shows the download happening rather than starting it unseen.
          void backend.downloadUpdate()
            .then((ready) => setUpdateStatus({ kind: "ready", version: ready.version }))
            .catch(() => setUpdateError("Couldn’t download the update. Please try again."));
        }
      } catch {
        setUpdateStatus({ kind: "idle" });
        setUpdateError("Couldn’t check for updates. Please try again.");
      }
    })();
  };

  const statusText = updateStatus.kind === "checking"
    ? t("Checking for updates…")
    : updateStatus.kind === "store"
    ? t("This copy of Trackbox is from the Microsoft Store. Get updates from the Microsoft Store.")
    : updateStatus.kind === "upToDate"
    ? t("Trackbox v{version} is up to date.", { version: updateStatus.version })
    : updateStatus.kind === "available"
    ? t("Update available v{version}.", { version: updateStatus.version })
    : updateStatus.kind === "ready"
    ? t("Update v{version} downloaded — restart Trackbox to use it.", { version: updateStatus.version })
    : null;

  // Done when the last event's downloaded byte count reached the total; the
  // final event of a download always carries that, even with no total known
  // until then.
  const downloading = progress !== null && !(progress.total !== null && progress.downloaded >= progress.total);

  return (
    <>
      <section className={styles.section} aria-label="About">
        <div className={styles.aboutHeader}>
          <div>
            <h1 className={styles.aboutName}>Trackbox</h1>
            <p className={styles.aboutVersion} data-testid="about-version">v{version ?? "—"}</p>
          </div>
          <Button disabled={updateStatus.kind === "checking"} onClick={checkForUpdates}>
            {updateStatus.kind === "checking" ? "Checking…" : "Check for updates"}
          </Button>
        </div>
        <div className={styles.aboutUpdates}>
          <div className={styles.updateControls}>
            <Toggle
              label="Download updates"
              checked={checkUpdates}
              onChange={(checkUpdates) => update("advanced", { checkUpdates })}
            />
            <Select
              label="Update frequency"
              disabled={!checkUpdates}
              value={updateFrequency}
              choices={[
                { value: "start", label: "After startup" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
              ]}
              onChange={(updateFrequency) => update("advanced", { updateFrequency })}
            />
          </div>
          <p className={layout.help}>Trackbox updates are not yet configured; see GitHub Releases for future builds.</p>
          {statusText ? <p className={styles.updateHint} aria-live="polite">{statusText}</p> : null}
          {downloading ? (
            <div className={styles.updateProgressRow}>
              <div
                className={styles.updateProgress}
                role="progressbar"
                aria-label="Downloading update"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  progress?.total != null ? Math.round((progress.downloaded / progress.total) * 100) : undefined
                }
                data-indeterminate={progress?.total == null || undefined}
              >
                <span
                  className={styles.updateProgressFill}
                  style={
                    progress?.total != null
                      ? { width: `${Math.min((progress.downloaded / progress.total) * 100, 100)}%` }
                      : undefined
                  }
                />
              </div>
              <span className={styles.updateProgressText}>
                {progress?.total != null
                  ? `${formatBytes(progress.downloaded)} of ${formatBytes(progress.total)}`
                  : formatBytes(progress?.downloaded ?? 0)}
              </span>
            </div>
          ) : null}
          {updateError ? <p className={styles.updateError} role="alert">{updateError}</p> : null}
        </div>
        <div className={styles.aboutSupport}>
          <h2>About Trackbox</h2>
          <p>Trackbox builds on RBXport, originally developed by Chris Le (TRIODE).</p>
          <p>The original RBXport author can be supported independently of Trackbox.</p>
          <Button className={styles.supportButton} onClick={() => open(SUPPORT_URL)}><Heart className={styles.supportHeart} size={16} aria-hidden="true" /> Support RBXport author</Button>
        </div>
      </section>
      <div className={styles.aboutLegal}>
        <details>
          <summary>Licence</summary>
          <p className={styles.aboutLine}>
            Trackbox is based on RBXport and is free software, licensed under the GNU General Public License version 2 or, at your
            option, any later version. It comes with no warranty. It includes the Rubber Band Library
            by Particular Programs Ltd., under the same licence.
          </p>
        </details>
        <details>
          <summary>Disclaimer</summary>
          <p className={styles.aboutLine}>
            Trackbox is an independent project and is not affiliated with, endorsed by, or sponsored by
            AlphaTheta Corporation, Pioneer DJ, or any other third party. rekordbox, CDJ, XDJ and
            PRO DJ LINK are trademarks of their respective owners. Back up your library before using
            any feature that writes to it.
          </p>
        </details>
      </div>
      <footer className={styles.aboutFoot}>
        <div className={styles.aboutLinks} role="group" aria-label="Author links">
          {ABOUT_LINKS.map(({ label, url, Icon }) => (
            <button key={label} type="button" className={styles.aboutSocial} aria-label={label} title={label} onClick={() => open(url)}>
              <Icon size={19} aria-hidden="true" />
            </button>
          ))}
        </div>
        <p className={styles.aboutMade}><span>Based on RBXport, created by TRIODE with</span> <Heart className={styles.supportHeart} size="1em" aria-hidden="true" /> <span>in California</span></p>
      </footer>
    </>
  );
}
