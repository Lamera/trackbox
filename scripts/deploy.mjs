#!/usr/bin/env node
// Safety stop for RBXport's former deployment entry point.  Trackbox never
// promotes the old dev branch or publishes to upstream distribution services.
console.error(
  "The upstream RBXport deployment command is disabled in Trackbox. " +
  "Use GitHub Actions > Trackbox release (manual) on the main branch instead.",
);
process.exitCode = 1;
