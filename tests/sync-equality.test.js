import { expect, it } from "vitest";
import { changedSyncKeysAsync, emptySyncModel, equalSyncValuesAsync, syncJson, versionSyncDiffAsync } from "../src/core/webdav-sync-model.js";

it("compares unchanged projected records without constructing both canonical strings", async () => {
  const before = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ["car_list/TEST-" + i, { "f:carNum": "TEST-" + i, "f:names": "Fixture", "flag:favorite": false, "flag:downloaded": true }]));
  const samples = [];
  const result = await versionSyncDiffAsync(emptySyncModel(), before, structuredClone(before), [1, "replica"], { diagnostics: { recordComputation: (phase, sample) => samples.push({ phase, ...sample }) } }, true);
  expect(result.changed).toBe(false);
  expect(samples.find(sample => sample.phase === "sync.versionSyncDiff").steps).toBeLessThan(16000);
});

it("matches existing canonical equality for missing values, holes and unusual primitives", async () => {
  const pairs = [
    [{ z: 2, a: 1 }, { a: 1, z: 2 }], [undefined, null], [{}, { a: undefined }],
    [{ a: undefined }, { a() {} }], [[], Array(1)], [[undefined], Array(1)],
    [[() => {}], Array(1)], [Array(2), []], [NaN, null], [Infinity, null], [-0, 0],
    [new Date(0), {}], [{ x: [1, null, { b: true }] }, { x: [1, null, { b: false }] }],
  ];
  for (const [left, right] of pairs) {
    expect(await changedSyncKeysAsync({ item: left }, { item: right })).toEqual(syncJson(left) === syncJson(right) ? [] : ["item"]);
  }
});

it("matches canonical equality for deterministic generated JSON trees", async () => {
  let seed = 419;
  const random = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
  const tree = depth => depth && random(3) ? random(2) ? Array.from({ length: random(4) }, () => tree(depth - 1)) : Object.fromEntries(Array.from({ length: random(4) }, (_, i) => ["k" + i, tree(depth - 1)])) : [null, true, false, random(100), "v" + random(100)][random(5)];
  for (let i = 0; i < 160; i++) {
    const left = tree(4), right = i % 2 ? structuredClone(left) : tree(4);
    expect(await changedSyncKeysAsync({ item: left }, { item: right })).toEqual(syncJson(left) === syncJson(right) ? [] : ["item"]);
  }
});

it("keeps unsupported BigInt rejection and cancels large equality traversals", async () => {
  await expect(changedSyncKeysAsync({ item: 1n }, { item: 1n })).rejects.toBeInstanceOf(TypeError);
  const controller = new AbortController(); let clock = 0;
  const large = { item: Array.from({ length: 10000 }, (_, i) => ({ n: i })) };
  await expect(changedSyncKeysAsync(large, structuredClone(large), { clock: () => clock += 5, signal: controller.signal, yieldTask: async () => controller.abort() })).rejects.toMatchObject({ name: "AbortError" });
});

it("still rejects invalid tails after finding an earlier difference", async () => {
  for (const [left, right] of [[{ a: 0, b: 1n }, { a: 1, b: 1n }], [{ a: 1n }, { a: 1n, b: 2 }], [[0, 1n], [1, 1n]]]) {
    await expect(equalSyncValuesAsync(left, right)).rejects.toBeInstanceOf(TypeError);
  }
  const cyclic = { a: 0 }; cyclic.tail = cyclic;
  await expect(equalSyncValuesAsync(cyclic, { a: 1 })).rejects.toBeInstanceOf(RangeError);
});
