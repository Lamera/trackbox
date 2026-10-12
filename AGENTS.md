# Trackbox — Agent and Contributor Instructions

Trackbox is an open-source DJ application based on the RBXport project. Its goal is to expand the existing music-library, analysis, export, and two-deck capabilities into a capable DJ performance application.

This document guides coding agents and contributors. It applies repository-wide unless a more specific `AGENTS.md` exists in a subdirectory.

## Product direction

- Preserve the existing library-management and USB-export functionality.
- Introduce a distinct **PERFORMANCE** mode alongside the existing **EXPORT** workflow.
- Start with **two decks** (A/B): independent transport, tempo/pitch, beat/BPM sync, cue points, loops, channel mixer, and ultimately separate headphone cue monitoring.
- Reuse and validate existing functionality first; avoid reimplementing audio playback, sync, analysis, beatgrids, mixer DSP, or waveforms simply because a new mode needs them.
- Build incrementally, with playable and testable milestones. Do not add four-deck or large FX systems before the two-deck workflow is reliable.

## Non-negotiable UI and design direction

**Trackbox builds on the current RBXport UI; it is not a visual redesign.**

- Keep the existing design language, interaction patterns, visual density, typography, icons, spacing, colors, waveforms, and component treatments intact by default.
- Use the existing design tokens and styling foundations in `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/theme.ts`, and nearby component CSS modules.
- **Do not introduce a second design system**, new global palette, unrelated branding aesthetics, or a Serato-/rekordbox-inspired visual reskin.
- When creating PERFORMANCE mode, primarily **rearrange existing deck and mixer components** for live use instead of recreating their appearance.
- Prefer extending `src/views/player/Player.tsx`, `DualDeck.tsx`, `MixerStrip.tsx`, existing waveform views and their hooks over building duplicate UI components.
- Add mode-specific containers/layout components only when useful for composition; keep common playback controls and behavior shared.
- Maintain existing EXPORT layouts. New PERFORMANCE arrangements must not break, replace, or visually regress them.
- Different deck arrangements (stacked horizontal waveforms, side-by-side decks, etc.) should be achievable by layout configuration and composition, not by copying the player implementation.
- New controls (e.g. channel fader, adjustable EQ, headphone CUE) must look and behave like native parts of the existing interface: reuse tokens, controls, accessibility conventions, shortcuts, and tooltips.
- Branding updates to "Trackbox" should be a separate, deliberate task. Preserve upstream copyright/license attribution and do not conflate renaming with redesign.
- Review existing screenshots/tests before visual changes; use targeted screenshots or UI tests to guard the established interface.

## Architecture boundaries

- Frontend: React/TypeScript in `src/`. Put UI in `src/views/`, shared state in `src/store/`, typed backend contracts in `src/ipc/`.
- Native shell: Tauri 2 in `src-tauri/`. Keep native commands as thin adapters.
- Rust crates in `crates/` own audio, analysis, database, export, and PRO DJ LINK; do not duplicate these responsibilities in frontend code.
- `crates/rbl-deck/` is the existing two-deck, time-stretching, mixer and rendering engine. The existing deck transport, tempo, key shift, sync and mixer APIs are the starting point.
- Preserve the real-time audio contract: **no file I/O, blocking locks, or steady-state allocations inside the audio callback**. Keep decode and control work off the callback thread.
- For audio output changes, verify both decks, audio device selection, sample rate/buffer settings, underrun behavior, clicks, peak limiting, and graceful device failures.
- Keep headphone preview/CUE separate from the master output; a single stereo master is not equivalent to a usable DJ monitoring path. Implement proper output routing before declaring the performance mode ready for real DJ use.
- Keep and extend unit/integration tests for sync, tempo, cue/loop behavior, mixer DSP, and audio output. Prefer deterministic, synthetic audio fixtures and null/test sinks.

## Working process

1. Inspect existing implementations and documentation before proposing a new component or DSP feature.
2. Make focused changes, separating visual layout, new controls, audio-engine modifications, and branding whenever practical.
3. Avoid broad formatting, CSS rewrites, or renaming unrelated modules.
4. Keep accessibility (keyboard and pointer operation, readable control labels, visual states) and responsive sizing consistent with current UI.
5. When functionality is unavailable, show an honest disabled/error state rather than a control that appears working but silently does nothing.
6. Update relevant tests and documentation; explain any platform-specific behavior and limitations.
7. Prefer small PRs with a clear verification plan. Do not claim real-device or low-latency DJ readiness from mock/browser-only tests.

## Validation

Start with the commands described in `README.md` and `docs/development/getting-started.md`, including:

```sh
pnpm lint
pnpm build
pnpm test
RB_LITE_TEST=1 cargo test -p rbl-deck
```

Use the documented isolated-library fixtures. Never write to an actual user's rekordbox library, change live DJ device data, or export to a real USB drive while testing without an explicit and informed request.

## CI and release safety during the fork transition

- Existing GitHub Actions workflows, self-hosted runner labels, secrets, signing steps, artifact names, URLs, and external integrations were designed for **RBXport**, not Trackbox.
- Treat them as **upstream infrastructure**, not as ready-to-use Trackbox deployment configuration. Review and deliberately migrate them before enabling publishing or distributing Trackbox releases.
- Do not invoke an upstream production release workflow, submit to the original Microsoft Store identity, upload to the upstream Cloudflare R2 bucket, send upstream Discord/support notifications, or reuse original signing identities.
- Prefer a separate, read-only, GitHub-hosted PR validation baseline when migrating CI; avoid mandatory reliance on upstream self-hosted runners. Never execute untrusted PR code on privileged self-hosted runners.
- Keep PR checks (lint, tests, builds) separate from release/publish jobs. Only enable Trackbox signing and distribution after new identifiers, destinations, and credentials are configured.
- Keep upstream acknowledgments and GPL-2.0-or-later requirements intact; consult `LICENSE` and `LICENSING.md` before changing distribution or third-party dependency handling.
