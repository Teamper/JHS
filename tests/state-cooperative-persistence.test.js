import { afterEach, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { ComputationBudget } from "../src/core/cooperative-work.js";
afterEach(() => vi.unstubAllGlobals());
it("yields while cloning the existing full-domain journal without changing its schema", async () => {
  vi.stubGlobal("utils", { getNowStr: () => "2026-10-24T00:00:00.000Z" });
  vi.stubGlobal("window", { location: { href: "https://javdb.com/" } });
  const values = new Map([["car_list", Array.from({ length: 1000 }, (_, i) => ({ carNum: "LIB-" + i, stateFlags: { favorite: true } }))]]);
  let journal;
  const storage = { car_list_key: "car_list", favorite_actresses_key: "favorite_actresses", forage: {
    getItem: async key => structuredClone(values.get(key) ?? null),
    setItem: async (key, value) => { if (key === "mutation_journal") journal = structuredClone(value); values.set(key, structuredClone(value)); },
    removeItem: async key => values.delete(key),
  } };
  const service = new StateService(storage, { emit: async () => {} });
  let now = 0, yields = 0;
  service.computation = new ComputationBudget({ clock: () => (now += 5), yieldTask: async () => { yields++; } });
  await service.patch("LIB-1", { favorite: false });
  expect(yields).toBeGreaterThan(0);
  expect(journal).toMatchObject({ schema: 2, touchedDomains: ["carList", "activity"] });
  expect(values.get("car_list").find(item => item.carNum === "LIB-1").stateFlags.favorite).toBe(false);
});


it("toggles from one fresh domain read under the transaction lock", async () => {
  vi.stubGlobal("utils", { getNowStr: () => "2026-10-24T00:00:00.000Z" });
  vi.stubGlobal("window", { location: { href: "https://javdb.com/" } });
  const values = new Map([["car_list", [{ carNum: "LIB-1", stateFlags: { favorite: false } }]]]);
  const storage = { car_list_key: "car_list", favorite_actresses_key: "favorite_actresses", forage: {
    getItem: vi.fn(async key => structuredClone(values.get(key) ?? null)),
    setItem: async (key, value) => values.set(key, structuredClone(value)),
    removeItem: async key => values.delete(key),
  }, getCar: async key => (await storage.forage.getItem("car_list")).find(row => row.carNum === key) };
  const service = new StateService(storage, { emit: async () => {} });
  await service.toggle("LIB-1", "favorite");
  expect(values.get("car_list")[0].stateFlags.favorite).toBe(true);
  expect(storage.forage.getItem.mock.calls.filter(([key]) => key === "car_list")).toHaveLength(1);
  expect(storage.forage.getItem.mock.calls.filter(([key]) => key === "mutation_journal")).toHaveLength(1);
});
