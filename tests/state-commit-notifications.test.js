import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { JhsEventBus } from "../src/core/event-bus.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";

class Channel {
  constructor() { this.posts = []; }
  addEventListener() {}
  postMessage(event) { this.posts.push(structuredClone(event)); }
}
beforeEach(() => {
  vi.stubGlobal("BroadcastChannel", Channel);
  vi.stubGlobal("utils", { getNowStr: () => "2026-10-24T00:00:00.000Z" });
  vi.stubGlobal("window", { location: { href: "https://javdb.com/" } });
});
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const values = new Map();
  const storage = { car_list_key: "car_list", favorite_actresses_key: "favorite_actresses", _invalidateCache() {}, forage: {
    getItem: async key => structuredClone(values.get(key) ?? null),
    setItem: async (key, value) => values.set(key, structuredClone(value)),
    removeItem: async key => values.delete(key),
  } };
  const errors = [], events = new JhsEventBus("commit-test", { errorReporter: error => errors.push(error) });
  const coordinator = new StorageMutationCoordinator({ lockManager: null });
  return { values, events, errors, service: new StateService(storage, events, coordinator) };
}
const settledSoon = promise => Promise.race([promise.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 80))]);

it("releases a durable mark and the next writer while a local listener is blocked", async () => {
  const { service, values, events } = fixture();
  let release, entered;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => entered = resolve);
  events.on("car-state-changed", async () => { entered(); await gate; });
  const first = service.patch("TEST-1", { favorite: true });
  try {
    await started;
    expect(values.get("car_list")[0].stateFlags.favorite).toBe(true);
    expect(values.has("mutation_journal")).toBe(false);
    const second = service.patch("TEST-2", { downloaded: true });
    expect(await settledSoon(Promise.all([first, second]))).toBe(true);
    expect(values.get("car_list").find(row => row.carNum === "TEST-2").stateFlags.downloaded).toBe(true);
  } finally { release(); await first; }
});

it("broadcasts every committed notice before starting its ordered local delivery", async () => {
  const { service, events } = fixture();
  let release, entered;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => entered = resolve), local = [];
  events.on("car-state-changed", async payload => { local.push(payload.carNums[0]); entered(); await gate; });
  const first = service.patch("TEST-1", { favorite: true });
  try {
    await started;
    expect(events.channel.posts.some(event => event.type === "activity-log-changed")).toBe(true);
    await service.patch("TEST-2", { favorite: true });
    expect(events.channel.posts.filter(event => event.type === "car-state-changed").map(event => event.payload.carNums[0])).toEqual(["TEST-1", "TEST-2"]);
    expect(local).toEqual(["TEST-1"]);
  } finally { release(); await first; }
  await vi.waitFor(() => expect(local).toEqual(["TEST-1", "TEST-2"]));
});

it("keeps saved state successful and delivers later handlers after listener failure", async () => {
  const { service, values, events, errors } = fixture();
  const delivered = [];
  events.on("car-state-changed", () => { throw new Error("broken view"); });
  events.on("activity-log-changed", payload => delivered.push(payload.transactionId));
  const result = await service.patch("TEST-1", { favorite: true });
  expect(values.get("car_list")[0].stateFlags.favorite).toBe(true);
  await vi.waitFor(() => expect(delivered).toEqual([result.transactionId]));
  expect(errors.map(error => error.message)).toEqual(["broken view"]);
});
