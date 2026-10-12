# Trackbox GitHub Actions

The default CI entry point is `.github/workflows/ci.yml`. It runs on PRs targeting `main`, pushes to `main`, and manual dispatch, using **GitHub-hosted runners** and **read-only repository permissions**.

The initial, public validation lanes are:

- Frontend: lint, TypeScript, Vitest, production build and bundle budget.
- Browser: Playwright with the mocked backend in Chromium.
- Scripts: Node.js script tests.
- Rust deck: rustfmt, Clippy and deterministic two-deck audio-engine tests, guarded by `RB_LITE_TEST=1`.

The former RBXport PR autofix/self-hosted pipeline has been replaced. It must not be reactivated without explicitly reviewing fork safety and runner access.

## Release and support integration

The original release coordinator (`release.yml`) and upstream Discord support synchronization (`support-sync.yml`) have been replaced with harmless manual placeholders. **They do not publish anything.** The old implementations remain in upstream Git history if a migration reference is needed.

Other inherited reusable workflows (for native smoke testing and packaging) are currently **not part of the public Trackbox CI**. They still contain upstream names and self-hosted runner assumptions. Do not invoke them or wire them into a release until audited and adapted.

See issue #1 for remaining cross-platform CI work, #2 for application identity and #3 for Trackbox-owned unsigned GitHub Releases.

## Local baseline

```sh
corepack enable
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm budget
RB_LITE_TEST=1 cargo test -p rbl-deck
```

Browser smoke tests additionally require `pnpm exec playwright install chromium` and `pnpm exec playwright test --project=chromium` after the production build. Native tests/real DJ hardware require additional evidence; browser mocks alone cannot establish working audio.
