# Trackbox releases

[Documentation](../README.md) · [CI](../../.github/workflows/README.md)

Trackbox has a **separate, explicitly manual** release path. Do **not** invoke
RBXport's historical deployment commands or reused signing/publishing actions.
The inherited `scripts/deploy.mjs`, `release-publish.yml` and
`release-store.yml` are deliberately inert in this fork. The former signing,
installer and updater infrastructure is not owned by Trackbox.

## Stage an unsigned Linux preview

1. Merge the intended source to `main`; confirm the normal Trackbox CI is green.
2. Open **Actions → Trackbox release (manual) → Run workflow**. Select `main`.
3. Enter a new `X.Y.Z` version (for example `0.1.0`) without `v`.
4. Leave **Create a DRAFT GitHub Release** off for build-only verification, or
   enable it to create a **draft** release after packaging succeeds.
5. Download the `trackbox-vX.Y.Z-linux-x86_64-unsigned` Actions artifact,
   or review the draft release's Linux `.AppImage` and `.deb` files.
6. Check `SHA256SUMS-linux-x86_64.txt` against the downloaded payloads.
   Publish a reviewed draft manually through GitHub; the workflow **never**
   makes a public release automatically.

The workflow refuses a different repository, any ref other than `main`,
invalid version input, or a reused tag. During packaging,
`node scripts/sync-version.mjs --version X.Y.Z` stages consistent manifest
versions in the CI checkout only. It does **not** push version changes, change
`main`, force-push tags, or modify GitHub branch history. The draft release
uses the workflow's exact source commit as its target.

Linux uses a GitHub-hosted Ubuntu 22.04 runner and produces unsigned x86_64
AppImage and DEB packages. Build artifacts are retained in Actions for 30 days.
There are no upstream endpoints, Cloudflare R2 credentials, Discord
announcements, Microsoft Store submissions, Apple signing, code signing or
Tauri updater artifacts in this workflow.

## What is intentionally not finished yet

- The inherited `1.6.0` manifest version and some crate/binary filenames
  are still RBXport-era metadata. A staged version is used only for release
  packaging until Trackbox adopts independent source versioning (#2).
- The Windows NSIS hooks still reference a privileged RBXport update task;
  **do not distribute a Windows installer** until these are removed and
  reviewed. macOS app/DMG and Windows packages are not produced by the
  initial workflow; both require separate unsigned packaging/smoke checks (#3).
- The app currently has **no Trackbox auto-update feed** and unsigned builds
  should not claim platform signing/notarization. Users may encounter
  operating-system trust prompts.
- Original RBXport upstream authorship/copyright, the
  GPL-2.0-or-later license and third-party license notices must be retained.

The initial workflow is an infrastructure foundation, not a validated native
release. A successful TypeScript/browser CI run does not prove native app
launches, sound-card outputs or USB-device safety.

## Local verification

```sh
node --test scripts/ci/trackbox-release.test.mjs
pnpm lint
pnpm test
pnpm build
RB_LITE_TEST=1 cargo test -p rbl-deck
```

Never run `npm run deploy` or invoke old RBXport R2/Store commands. Those
commands are intentionally disabled rather than implicitly repointed.
