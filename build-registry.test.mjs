// Tests for build-registry.mjs's version records. Run: node --test build-registry.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UNREADABLE,
  branchFields,
  branchOrPrevious,
  compareSemver,
  eligibleReleases,
  fetchHeadManifest,
  iconFromManifest,
  pickVersionFields,
  releaseFields,
  sameCatalog,
} from "./build-registry.mjs";

const REPO = "acme/widget";
const dl = (tag, name) => `https://github.com/${REPO}/releases/download/${tag}/${name}`;
const gh = (tag, over = {}) => ({ tag_name: tag, draft: false, prerelease: false, assets: [], ...over });
const manifests = (map) => async (tag) => (tag in map ? map[tag] : null);

test("latest is the highest full release, with its minAppVersion and zips", async () => {
  const payload = [
    gh("v1.2.0"),
    gh("v1.3.0", {
      assets: [
        { name: "w.zip", browser_download_url: dl("v1.3.0", "w.zip") },
        { name: "notes.txt", browser_download_url: dl("v1.3.0", "notes.txt") },
      ],
    }),
    gh("nightly"),
    gh("v2.0.0", { draft: true }),
  ];
  assert.deepEqual(
    await releaseFields(payload, REPO, manifests({ "v1.3.0": { version: "1.3.0", minAppVersion: "2.6.0" } })),
    {
      latest: { version: "1.3.0", tag: "v1.3.0", from: "release", zips: [dl("v1.3.0", "w.zip")], minAppVersion: "2.6.0" },
    },
  );
});

test("a newer pre-release is recorded beside latest", async () => {
  const payload = [gh("v1.4.0-beta.1"), gh("v1.3.0"), gh("v1.3.0-rc.1", { prerelease: true })];
  assert.deepEqual(await releaseFields(payload, REPO, manifests({})), {
    latest: { version: "1.3.0", tag: "v1.3.0", from: "release", zips: [] },
    prerelease: { version: "1.4.0-beta.1", tag: "v1.4.0-beta.1", from: "release", zips: [] },
  });
});

test("a release whose manifest disagrees is skipped for the next one", async () => {
  const fields = await releaseFields(
    [gh("v1.3.0"), gh("v1.2.0")],
    REPO,
    manifests({ "v1.3.0": { version: "1.2.9" }, "v1.2.0": { version: "1.2.0" } }),
  );
  assert.equal(fields.latest.version, "1.2.0");
});

test("records the disagreement when no full release agrees", async () => {
  assert.deepEqual(
    await releaseFields([gh("v1.3.0")], REPO, manifests({ "v1.3.0": { version: "1.2.0" } })),
    { releaseError: "v1.3.0: safelight.json says 1.2.0" },
  );
});

test("a repo with only pre-releases gets no version fields", async () => {
  assert.deepEqual(await releaseFields([gh("v2.0.0-rc.1")], REPO, manifests({})), {});
});

test("a repo without releases is left to its branch", async () => {
  assert.equal(await releaseFields([], REPO, manifests({})), null);
  assert.deepEqual(branchFields({ version: "1.2.0", minAppVersion: "2.0.0" }), {
    latest: { version: "1.2.0", from: "branch", minAppVersion: "2.0.0" },
  });
  assert.deepEqual(branchFields(null), {});
  assert.deepEqual(branchFields({ version: "soon" }), {});
});

test("zips are capped at three and must be the repo's own downloads", () => {
  const asset = (name, url = dl("v1.0.0", name)) => ({ name, browser_download_url: url });
  const [r] = eligibleReleases(
    [
      gh("v1.0.0", {
        assets: [
          asset("a.zip"),
          asset("x.txt"),
          asset("b.zip", "https://example.com/b.zip"),
          asset("c.zip"),
          asset("d.zip"),
          asset("e.zip"),
        ],
      }),
    ],
    REPO,
  );
  assert.deepEqual(r.zips, [dl("v1.0.0", "a.zip"), dl("v1.0.0", "c.zip"), dl("v1.0.0", "d.zip")]);
});

test("version order matches the app's", () => {
  assert.equal(compareSemver("1.3.0", "1.3.0-beta.2"), 1);
  assert.equal(compareSemver("1.3.0-beta.10", "1.3.0-beta.2"), 1);
  assert.equal(compareSemver("v1.3", "1.3.0"), 0);
  assert.equal(compareSemver("1.10.0", "1.9.0"), 1);
});

test("a failed lookup keeps the previous build's version fields", () => {
  assert.deepEqual(
    pickVersionFields({ fullName: REPO, stars: 3, latest: { version: "1.0.0", from: "branch" } }),
    { latest: { version: "1.0.0", from: "branch" } },
  );
  assert.deepEqual(pickVersionFields(undefined), {});
});

test("catalogs that differ only in generatedAt are the same", () => {
  const a = { schemaVersion: 1, generatedAt: "2026-10-08T10:00:00Z", extensions: [{ fullName: REPO }] };
  assert.equal(sameCatalog(a, { ...a, generatedAt: "2026-10-08T11:00:00Z" }), true);
  assert.equal(sameCatalog(a, { ...a, extensions: [] }), false);
  assert.equal(sameCatalog(null, a), false);
});

// ── HEAD manifest reads: a missing manifest vs one GitHub could not give us ──

const realFetch = globalThis.fetch;
async function withFetch(stub, run) {
  globalThis.fetch = stub;
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
  }
}
const headManifest = (stub, ms) => withFetch(stub, () => fetchHeadManifest(REPO, ms));
const stalls = (_url, init) =>
  new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
const stallsBody = async (_url, init) =>
  new Response(
    new ReadableStream({
      start(c) {
        init.signal.addEventListener("abort", () => c.error(new Error("aborted")));
      },
    }),
    { status: 200 },
  );

test("a 404 HEAD manifest is missing; other statuses and network errors are unreadable", async () => {
  assert.equal(await headManifest(async () => new Response("", { status: 404 })), null);
  assert.equal(await headManifest(async () => new Response("", { status: 500 })), UNREADABLE);
  assert.equal(await headManifest(async () => new Response("", { status: 429 })), UNREADABLE);
  assert.equal(
    await headManifest(async () => {
      throw new TypeError("fetch failed");
    }),
    UNREADABLE,
  );
});

test("a 200 whose body is not JSON is a missing manifest", async () => {
  assert.equal(await headManifest(async () => new Response("<html>", { status: 200 })), null);
});

test("a HEAD manifest that stalls, in headers or in body, is unreadable", { timeout: 2000 }, async () => {
  assert.equal(await headManifest(stalls, 20), UNREADABLE);
  assert.equal(await headManifest(stallsBody, 20), UNREADABLE);
});

// ── The branch path: what a repo with no releases records ──

const previous = { fullName: REPO, stars: 3, latest: { version: "1.0.0", from: "branch" } };
const branchPath = (stub) => withFetch(stub, async () => branchOrPrevious(await fetchHeadManifest(REPO), previous));

test("an unreadable HEAD manifest keeps the previous build's latest", async () => {
  assert.deepEqual(await branchPath(async () => new Response("", { status: 500 })), {
    latest: { version: "1.0.0", from: "branch" },
  });
});

test("a missing HEAD manifest (404) gives no version fields", async () => {
  assert.deepEqual(await branchPath(async () => new Response("", { status: 404 })), {});
});

test("a readable HEAD manifest gives the branch record", async () => {
  assert.deepEqual(await branchPath(async () => new Response('{"version":"1.2.0"}', { status: 200 })), {
    latest: { version: "1.2.0", from: "branch" },
  });
});

test("an unreadable manifest gives the store thumbnail no icon", () => {
  assert.equal(iconFromManifest(REPO, UNREADABLE), null);
});
