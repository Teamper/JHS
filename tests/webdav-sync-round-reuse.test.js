import { afterEach, expect, it, vi } from "vitest";
import { memoryDav, syncReplica } from "./helpers/webdav-sync-fixture.js";
import { SYNC_DOMAINS } from "../src/core/webdav-sync-model.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("uses one full repair for first join and its publication in the same round", async () => {
  const a = await syncReplica(memoryDav(), { data: { car_list: [{ carNum: "TEST-1", stateFlags: { favorite: true } }] } });
  const reconcile = vi.spyOn(a.store, "computeReconciliation");
  await a.service.check();
  expect((await a.store.read()).joined).toBe(true);
  expect((await a.store.read()).pending).toBeNull();
  expect(reconcile).toHaveBeenCalledOnce();
});

it("reads business domains once per unchanged round while repairing bypassed writes next round", async () => {
  const a = await syncReplica(memoryDav()); await a.service.check();
  a.forage.getItem.mockClear();
  await a.service.check();
  for (const domain of SYNC_DOMAINS) expect(a.forage.getItem.mock.calls.filter(([key]) => key === domain)).toHaveLength(1);
  a.values.get("car_list").push({ carNum: "MISSED-1", stateFlags: { watched: true } });
  await a.service.check();
  expect((await a.store.read()).model.records["car_list/MISSED-1"].fields["flag:watched"].value).toBe(true);
});

it("does not repeat full reconciliation when publishing a local change", async () => {
  const a = await syncReplica(memoryDav()); await a.service.check();
  await a.state.patch("TEST-1", { downloaded: true });
  const reconcile = vi.spyOn(a.store, "computeReconciliation");
  await a.service.check();
  const state = await a.store.read();
  expect(state.dirty).toBe(false); expect(state.pending).toBeNull();
  expect(reconcile).toHaveBeenCalledOnce();
});

it("reports a durable queued local change as pending before its background accounting finishes", async () => {
  const a = await syncReplica(memoryDav()); await a.service.check();
  await a.state.patch("QUEUED-1", { downloaded: true });
  expect((await a.service.getStatus()).pendingChanges).toBeGreaterThan(0);
  await a.service.check();
  expect((await a.service.getStatus()).pendingChanges).toBe(0);
});

it.each(["business", "metadata"])("invalidates same-round proof after an intervening %s commit", async kind => {
  const remote = memoryDav(), a = await syncReplica(remote); await a.service.check();
  a.service.needsReconcile = true;
  const original = remote.client.listSyncFiles.getMockImplementation(); let changed = false;
  remote.client.listSyncFiles.mockImplementation(async (...args) => {
    if (!changed) {
      changed = true;
      if (kind === "business") await a.state.patch("LATER-1", { favorite: true });
      else await a.store.update(state => { state.localRevision += 1; state.dirty = true; });
    }
    return original(...args);
  });
  const reconcile = vi.spyOn(a.store, "computeReconciliation");
  await a.service.check();
  expect(reconcile.mock.calls.length).toBeGreaterThanOrEqual(2);
  const state = await a.store.read();
  expect(state.error).toBe("");
  if (kind === "business") expect(state.model.records["car_list/LATER-1"].fields["flag:favorite"].value).toBe(true);
});
