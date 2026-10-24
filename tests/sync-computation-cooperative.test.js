import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as model from "../src/core/webdav-sync-model.js";
const golden = JSON.parse(readFileSync(new URL("./fixtures/sync-computation-golden.json", import.meta.url), "utf8"));

describe("cooperative synchronization computations", () => {
  it("bounds traversal overhead for many small objects while preserving canonical bytes", async () => {
    const input = Array.from({ length: 1000 }, (_, i) => ({ z: i, d: false, c: null, b: "value", a: true }));
    const samples = [];
    const result = await model.syncJsonAsync(input, { diagnostics: { recordWork() {}, recordComputation: (phase, sample) => samples.push({ phase, ...sample }) } });
    expect(result).toBe(model.syncJson(input));
    expect(samples.find(sample => sample.phase === "sync.serialize").steps).toBeLessThan(20000);
  });
  it("keeps canonical serialization byte-identical, including undefined and key ordering", async () => {
    for (const input of [golden.joined, { z: [undefined, null, true], a: { b: 2, a: 1 } }, new Date(0)]) {
      expect(await model.syncJsonAsync(input)).toBe(model.syncJson(input));
    }
    expect(await model.syncJsonAsync(golden.joined)).toBe(golden.canonical);
  });
  it("counts projected records only during explicit diagnostic capture", async () => {
    const diagnostics = { performanceRecording: false, recordWork: vi.fn() };
    await model.projectSyncDataAsync(golden.data, {}, { diagnostics });
    expect(diagnostics.recordWork).not.toHaveBeenCalled();
    diagnostics.performanceRecording = true;
    await model.projectSyncDataAsync(golden.data, {}, { diagnostics });
    expect(diagnostics.recordWork).toHaveBeenCalledWith("sync.projectedRecords", Object.keys(golden.projection).length);
  });
  it("matches the frozen projection, field versions, join and materialization", async () => {
    const projection = await model.projectSyncDataAsync(golden.data);
    expect(projection).toEqual(golden.projection);
    const nextProjection = await model.projectSyncDataAsync(golden.changed);
    const difference = await model.versionSyncDiffAsync(golden.model, projection, nextProjection, [2, golden.version[1]]);
    expect(difference).toEqual(golden.difference);
    const joined = await model.joinSyncModelsAsync(golden.model, difference.model);
    expect(joined).toEqual(golden.joined);
    expect(await model.visibleSyncRecordsAsync(joined)).toEqual(golden.visible);
    expect(await model.materializeSyncDataAsync(joined, golden.data, ["a1"])).toEqual(golden.materialized);
    expect(golden.model.records["car_list/ABC-1"].fields["flag:favorite"].value).toBe(true);
  });
  it("can reuse locked snapshot records while isolating records changed by a diff", async () => {
    const before = structuredClone(golden.projection), after = structuredClone(before);
    after["car_list/ABC-1"]["flag:favorite"] = false;
    const input = structuredClone(golden.model);
    const result = await model.versionSyncDiffAsync(input, before, after, [2, golden.version[1]], undefined, true);
    expect(result.model.records["car_list/ABC-2"]).toBe(input.records["car_list/ABC-2"]);
    expect(result.model.records["car_list/ABC-1"]).not.toBe(input.records["car_list/ABC-1"]);
    result.model.records["car_list/ABC-1"].fields["flag:favorite"].value = true;
    expect(input).toEqual(golden.model);
  });
  it("yields within one actress's large nested video list and cancels without mutating inputs", async () => {
    const data = structuredClone(golden.data);
    data.favorite_actresses[0].newVideoList = Array.from({ length: 10000 }, (_, i) => ({ carNum: "ITEM-" + i, names: "Entry" }));
    const controller = new AbortController();
    let now = 0, yields = 0;
    const options = { clock: () => (now += .1), signal: controller.signal, yieldTask: async () => { yields++; if (yields === 3) controller.abort(); } };
    await expect(model.projectSyncDataAsync(data, {}, options)).rejects.toMatchObject({ name: "AbortError" });
    expect(yields).toBe(3);
    expect(data.favorite_actresses[0].newVideoList).toHaveLength(10000);
  });
  it("rejects a future envelope before scheduling any merged writes", async () => {
    await expect(model.validateSyncEnvelopeAsync({ schema: 2 })).rejects.toMatchObject({ code: "SYNC_FUTURE_VERSION" });
  });
  it("retains invalid-identity and version-conflict rejection", async () => {
    await expect(model.projectSyncDataAsync({ car_list: [{ carNum: "" }] })).rejects.toThrow("稳定标识");
    const conflicting = structuredClone(golden.model);
    conflicting.records["car_list/ABC-1"].fields["flag:favorite"].value = false;
    await expect(model.joinSyncModelsAsync(golden.model, conflicting)).rejects.toThrow("版本冲突");
  });
  it("matches nested toJSON omission, shared references and cyclic-input rejection", async () => {
    const shared = { n: 1 };
    const input = { omitted: { toJSON: () => undefined }, array: [{ toJSON: () => undefined }], a: shared, b: shared };
    expect(await model.syncCloneAsync(input)).toEqual(model.syncClone(input));
    const cyclic = {}; cyclic.self = cyclic;
    await expect(model.syncCloneAsync(cyclic)).rejects.toBeInstanceOf(TypeError);
  });
  it("serializes portable snapshots with native JSON bytes and omission rules", async () => {
    const input = { z: [undefined, NaN, new Date(0)], a: { x: undefined, n: 1 }, omitted: { toJSON: () => undefined } };
    expect(await model.stringifySyncDataAsync(input)).toBe(JSON.stringify(input));
  });
  it("clones JSON-compatible values incrementally with native JSON omission semantics", async () => {
    const input = { array: [undefined, NaN, new Date(0)], missing: undefined, value: { n: 1 } };
    const copy = await model.syncCloneAsync(input);
    expect(copy).toEqual(model.syncClone(input));
    copy.value.n = 2;
    expect(input.value.n).toBe(1);
  });
});
