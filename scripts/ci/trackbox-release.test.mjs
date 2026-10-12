import assert from "node:assert/strict";
import test from "node:test";
import { releaseVersion, verifyRelease } from "./trackbox-release.mjs";

const config = {
  productName: "Trackbox",
  identifier: "com.dme86.trackbox",
  bundle: { createUpdaterArtifacts: false },
  plugins: { updater: { endpoints: [] } },
};
const valid = { version: "0.1.0", repository: "dme86/trackbox", ref: "refs/heads/main", config };

test("accepts explicit Trackbox semver, but not untrusted or malformed tags", () => {
  for (const version of ["0.1.0", "1.0.0", "10.20.30"]) {
    assert.equal(releaseVersion(version), version);
  }
  for (const version of ["", "v0.1.0", "01.2.3", "1.2", "1.2.3-rc1", "1.2.3;echo bad", "../v1.0.0"]) {
    assert.throws(() => releaseVersion(version));
  }
});

test("does not release from a fork, tag, pull request or old upstream branch", () => {
  assert.equal(verifyRelease(valid), "0.1.0");
  for (const input of [
    { repository: "chrisle/rbxport" },
    { repository: "someone/trackbox" },
    { ref: "refs/heads/dev" },
    { ref: "refs/tags/v0.1.0" },
    { ref: "refs/pull/1/merge" },
  ]) {
    assert.throws(() => verifyRelease({ ...valid, ...input }));
  }
});

test("rejects upstream product identities and updater configurations", () => {
  for (const nextConfig of [
    { ...config, productName: "rbxport" },
    { ...config, identifier: "com.rbxport.app" },
    { ...config, bundle: { createUpdaterArtifacts: true } },
    { ...config, plugins: { updater: { endpoints: ["https://download.rbxport.com/latest.json"] } } },
  ]) {
    assert.throws(() => verifyRelease({ ...valid, config: nextConfig }));
  }
});
