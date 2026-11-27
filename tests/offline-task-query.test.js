import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createPan123Adapter } from "../src/integrations/pan123/manifest.js";
import { createOne115Adapter } from "../src/integrations/one115/manifest.js";
import { OfflineTaskQueryService } from "../src/services/offline-task-query-service.js";

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}-offline-tasks.json`, import.meta.url), "utf8"));
describe("cloud task queries", () => {
    it("reads signed 123 task pages through the integration", async () => {
        const http = { request: vi.fn(async () => ({ data: fixture("pan123") })) };
        const adapter = createPan123Adapter(http, { now: () => new Date("2026-11-16T00:00:00Z"), nonce: () => 1 });
        expect(await adapter.listTasks({ token: "fixture-token" })).toMatchObject({ total: 1, items: [{ id: "1001", status: "下载中", progress: 25 }] });
        expect(http.request.mock.calls[0][0]).toMatchObject({ capability: "offline.list", method: "POST", headers: { Authorization: "Bearer fixture-token" } });
        expect(JSON.parse(http.request.mock.calls[0][0].body)).toEqual({ current_page: 1, page_size: 100, status_arr: [0, 1, 2, 3] });
        await expect(adapter.listTasks()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    });
    it("normalizes 115 tasks and rejects authentication failures", async () => {
        const http = { request: vi.fn(async () => ({ data: fixture("one115") })) };
        const adapter = createOne115Adapter(http);
        expect(await adapter.listTasks()).toMatchObject({ items: [{ status: "完成", progress: 100 }] });
        expect(http.request.mock.calls[0][0].url).toContain("https://lixian.115.com/lixian/?ct=lixian&ac=task_lists");
        http.request.mockResolvedValue({ data: { state: false, error_msg: "请登录" } });
        await expect(adapter.listTasks()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    });
    it("persists poll deadlines and preserves cached tasks after a failed query", async () => {
        const records = new Map();
        const storage = { get: async key => records.get(key), set: async (key, value) => { records.set(key, value); } };
        const offline = { listTasks: vi.fn(async () => ({ page: 1, total: 1, items: [{ id: "task", name: "Fixture" }] })) };
        const deps = { storage, offline, settings: { snapshot: () => ({ enable115Offline: false }) }, token: async () => "fixture", clock: () => 1000 };
        const service = new OfflineTaskQueryService(deps);
        await service.refresh();
        await new OfflineTaskQueryService(deps).refresh();
        expect(offline.listTasks).toHaveBeenCalledTimes(1);
        offline.listTasks.mockRejectedValue(new Error("offline"));
        const state = await service.refresh(true);
        expect(state.pan123).toMatchObject({ items: [{ id: "task" }], reason: "offline", failures: 1, nextPollAt: 61000 });
        await service.resetProvider("pan123");
        expect((await service.read()).pan123).toBeUndefined();
        expect((await service.refresh(true)).pan123.items).toEqual([]);
    });

    it("discards account data on an authentication failure", async () => {
        let stored = { pan123: { items: [{ id: "old" }], total: 1 } };
        const storage = { get: async () => stored, set: async (_key, snapshot) => { stored = snapshot; } };
        const offline = { listTasks: async () => { throw Object.assign(new Error("expired"), { code: "AUTH_REQUIRED" }); } };
        const service = new OfflineTaskQueryService({ storage, offline, settings: { snapshot: () => ({}) }, token: async () => "fixture" });
        expect((await service.refresh(true)).pan123).toMatchObject({ items: [], total: 0, needsLogin: true });
        expect((await service.read()).pan123.items).toEqual([]);
    });

    it("cancels an in-flight account read before resetting its cached tasks", async () => {
        let stored = { one115: { items: [{ id: "old" }] } };
        const storage = { get: async () => stored, set: async (_key, snapshot) => { stored = snapshot; } };
        let finishRequest;
        const request = new Promise(resolve => { finishRequest = resolve; });
        const listTasks = vi.fn(async () => request);
        const service = new OfflineTaskQueryService({ storage, offline: { listTasks },
            settings: { snapshot: () => ({ enable115Offline: true }) }, token: async () => "" });
        const reading = service.refresh();
        const outcome = expect(reading).rejects.toMatchObject({ name: "AbortError" });
        await vi.waitFor(() => expect(listTasks).toHaveBeenCalledOnce());
        const { signal } = listTasks.mock.calls[0][1].scope;
        const reset = service.resetProvider("one115");
        expect(signal.aborted).toBe(true);
        finishRequest({ page: 1, total: 1, items: [{ id: "late" }] });
        await outcome;
        await reset;
        expect((await service.read()).one115).toBeUndefined();
    });
});
