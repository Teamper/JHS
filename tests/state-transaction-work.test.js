import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";

beforeEach(() => {
  vi.stubGlobal("utils", { getNowStr: () => "2026-10-24T00:00:00.000Z" });
  vi.stubGlobal("window", { location: { href: "https://javdb.com/" } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture(initial = {}) {
  const data = new Map(Object.entries(initial)), notices = [], journals = [];
  const storage = { car_list_key: "car_list", favorite_actresses_key: "favorite_actresses", _invalidateCache() {}, forage: {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { if (key === "mutation_journal") journals.push(structuredClone(value)); data.set(key, structuredClone(value)); },
    removeItem: async key => data.delete(key),
  } };
  return { data, notices, journals, service: new StateService(storage, { emit: async (type, payload) => notices.push({ type, payload }) }) };
}

it("prepares existing activity retention once for the pending and committed writes", async () => {
  const entries = Array.from({ length: 80 }, (_, i) => ({ id: "old-" + i, createdAt: "2026-10-23T01:00:00.000Z", commitState: "committed", changes: [] }));
  const { service, data, journals } = fixture({ activity_log: { entries } });
  const original = Date.parse; let scanned = 0;
  vi.spyOn(Date, "parse").mockImplementation(value => { if (value === "2026-10-23T01:00:00.000Z") scanned++; return original(value); });
  await service.patch("TEST-1", { favorite: true });
  expect(data.get("activity_log").entries).toHaveLength(81);
  expect(data.get("activity_log").entries.at(-1).commitState).toBe("committed");
  expect(journals[0].schema).toBe(2);
  expect(journals[0].before.activity.entries.map(entry => entry.id).sort()).toEqual(entries.map(entry => entry.id).sort());
  expect(journals[0].after.activity.entries.at(-1).commitState).toBe("pending");
  expect(scanned).toBe(80);
});

it("does not rescan all actress works for every unrelated movie in a batch", async () => {
  async function batch(count) {
    let reads = 0;
    const actors = Array.from({ length: 20 }, (_, i) => ({ starId: "actor-" + i, get newVideoList() { reads++; return ["NEW-" + i]; } }));
    const { service, data } = fixture({ favorite_actresses: actors });
    await service.patch(Array.from({ length: count }, (_, i) => "TEST-" + i), { favorite: true });
    expect(data.get("car_list").filter(row => row.stateFlags.favorite)).toHaveLength(count);
    return reads;
  }
  const one = await batch(1), hundred = await batch(100);
  expect(hundred).toBeLessThanOrEqual(one * 2);
});

it("does not inspect actress works when clearing a state flag", async () => {
  let reads = 0;
  const { service, data } = fixture({ car_list: [{ carNum: "TEST-1", stateFlags: { favorite: true } }], favorite_actresses: [{ starId: "a", get newVideoList() { reads++; return ["NEW-1"]; } }] });
  await service.patch("TEST-1", { favorite: false });
  expect(data.get("car_list")[0].stateFlags.favorite).toBe(false);
  expect(reads).toBe(0);
});

it("indexes only requested movie effects rather than allocating entries for unrelated works", async () => {
  let identities = 0;
  const actors = Array.from({ length: 20 }, (_, i) => ({ get starId() { identities++; return "actor-" + i; }, newVideoList: Array.from({ length: 60 }, (_, j) => "NEW-" + (i * 60 + j)) }));
  const { service, data } = fixture({ favorite_actresses: actors });
  await service.patch("TEST-1", { downloaded: true });
  expect(data.get("car_list")[0].stateFlags.downloaded).toBe(true);
  expect(identities).toBeLessThanOrEqual(actors.length * 2);
});

it("notifies new works only for targets whose work or decision actually changed", async () => {
  const { service, notices, data } = fixture({ favorite_actresses: [{ starId: "a", newVideoList: ["TEST-1"] }] });
  await service.patch(["TEST-1", "TEST-2"], { downloaded: true });
  expect(data.get("favorite_actresses")[0].newVideoList).toEqual([]);
  expect(notices.filter(event => event.type === "new-video-changed").map(event => event.payload.carNums)).toEqual([["TEST-1"]]);
  notices.length = 0;
  await service.patch("TEST-3", { favorite: true });
  expect(notices.some(event => event.type === "new-video-changed")).toBe(false);
});

it("reads recent list activity without consulting undo authorization", async () => {
  const log = { entries: [{ id: "recent", commitState: "committed", changes: [] }] };
  const { service } = fixture({ activity_log: log });
  service.storage.syncState = { refreshUndo: () => { throw new Error("history UI must not run"); } };
  expect(await service.getListActivity()).toEqual(log);
});

it("rejects a local commit snapshot after storage invalidation or a newer commit", async () => {
  const { service } = fixture(); let generation = 0;
  service.storage._invalidateCache = () => generation++;
  service.storage._getCacheGeneration = () => generation;
  const first = await service.patch("TEST-1", { favorite: true });
  expect(service.getCommittedListSnapshot(first.transactionId).records.get("TEST-1").stateFlags.favorite).toBe(true);
  service.storage._invalidateCache();
  expect(service.getCommittedListSnapshot(first.transactionId)).toBeNull();
  const second = await service.patch("TEST-2", { downloaded: true });
  expect(service.getCommittedListSnapshot(first.transactionId)).toBeNull();
  expect(service.getCommittedListSnapshot(second.transactionId).records.size).toBe(1);
  expect(service.getCommittedListSnapshot(second.transactionId, ["TEST-1", "TEST-2"])).toBeNull();
});

it("does not turn a saved mutation into failure when optional cache proof is unavailable", async () => {
  const { service, data } = fixture();
  service.storage._getCacheGeneration = () => { throw new Error("cache not initialized"); };
  await expect(service.patch("TEST-1", { downloaded: true })).resolves.toMatchObject({ changed: ["TEST-1"] });
  expect(data.get("car_list")[0].stateFlags.downloaded).toBe(true);
  expect(service.getCommittedListSnapshot("unknown")).toBeNull();
});
