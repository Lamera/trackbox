/**
 * Strict Trackbox release guard. The upstream deployment workflow is unsafe
 * for forks: never publish artifacts from an arbitrary repository/ref.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const TRACKBOX_REPOSITORY = "dme86/trackbox";

export function releaseVersion(value) {
  if (typeof value !== "string" ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error("Release version must be X.Y.Z without a leading v or prerelease suffix.");
  }
  return value;
}

export function verifyRelease({ version, repository, ref, config }) {
  const validVersion = releaseVersion(version);
  if (repository !== TRACKBOX_REPOSITORY || ref !== "refs/heads/main") {
    throw new Error("Trackbox releases can only run from dme86/trackbox main.");
  }
  if (config.productName !== "Trackbox" || config.identifier !== "com.dme86.trackbox") {
    throw new Error("Unexpected app identity: refusing to package another product.");
  }
  if (config.bundle?.createUpdaterArtifacts !== false ||
      !Array.isArray(config.plugins?.updater?.endpoints) ||
      config.plugins.updater.endpoints.length !== 0) {
    throw new Error("An upstream/automatic updater is configured; aborting unsigned release.");
  }
  return validVersion;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) ===
  fileURLToPath(new URL(process.argv[1], "file://" + process.cwd() + "/"));
if (invoked) {
  try {
    const config = JSON.parse(readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
    const version = verifyRelease({
      version: process.argv[2],
      repository: process.env.GITHUB_REPOSITORY,
      ref: process.env.GITHUB_REF,
      config,
    });
    process.stdout.write(version + "\n");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
