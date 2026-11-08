import { describe, expect, it, vi } from "vitest";
import { JavDbListService } from "../src/services/javdb-list-service.js";

const origin = "https://javdb.com";
const movies = Array.from({ length: 3 }, (_, index) => ({ carNum: `ABC-${index + 1}`, url: `${origin}/v/movie-${index + 1}` }));
const lists = [{ id: "list-a", name: "观看" }, { id: "list-b", name: "收藏" }];
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function locks() {
    const tails = new Map();
    return { request: vi.fn((name, options, callback) => {
        if (typeof options === "function") { callback = options; options = {}; }
        if (options.ifAvailable && tails.has(name)) return Promise.resolve(callback(null));
        const previous = tails.get(name) || Promise.resolve();
        const result = previous.then(() => callback({ name }));
        const tail = result.catch(() => {}).finally(() => { if (tails.get(name) === tail) tails.delete(name); });
        tails.set(name, tail);
        return result;
    }) };
}

function fixture({ data = new Map(), sharedLocks = locks(), account = "user-a" } = {}) {
    const server = new Map(), writes = [];
    const state = { account, origin, active: 0, maximum: 0, stopGate: null };
    const storage = {
        get: vi.fn(async key => structuredClone(data.get(key))),
        set: vi.fn(async (key, value) => { writes.push([key, structuredClone(value)]); data.set(key, structuredClone(value)); }),
        keys: async () => [...data.keys()],
    };
    const adapter = {
        readWebAccount: vi.fn(async () => state.account ? { identity: `id:${state.account}`, label: state.account, csrf: "fixture-csrf" } : null),
        readListPage: vi.fn(async (_origin, videoId) => ({ lists: lists.map(list => ({ ...list, checked: server.get(`${videoId}/${list.id}`) === true, disabled: false })), nextUrl: null })),
        setListMember: vi.fn(async (_origin, input) => { state.active++; state.maximum = Math.max(state.maximum, state.active); await state.stopGate?.promise; server.set(`${input.videoId}/${input.listId}`, input.checked); state.active--; return "accepted"; }),
    };
    const context = () => ({ origin: state.origin, accountUrl: `${state.origin}/users/edit` });
    const service = new JavDbListService({ storage, integrations: { getAdapter: () => adapter }, context, locks: sharedLocks });
    const create = async (selected = movies, selectedLists = lists, checked = true) => {
        const access = await service.access();
        return service.createTask({ movies: selected, lists: selectedLists, checked, expectedAccount: access.account?.fingerprint });
    };
    return { service, adapter, storage, data, server, state, writes, create, sharedLocks, context };
}

describe("recoverable JavDB list membership tasks", () => {
    it("prewrites every pair, processes lists sequentially per movie and limits concurrent movies to two", async () => {
        const f = fixture(), task = await f.create();
        const seen = [], write = f.adapter.setListMember.getMockImplementation();
        f.adapter.setListMember.mockImplementation(async (...args) => {
            const input = args[1], film = task.movies.findIndex(movie => movie.videoId === input.videoId), list = task.lists.findIndex(list => list.id === input.listId);
            expect(f.data.get(`jhs_javdb_list_task_v1:${task.id}/${film}/${list}`).state).toBe("submitting");
            seen.push([input.videoId, input.listId]);
            await new Promise(resolve => setTimeout(resolve, 5));
            return write(...args);
        });
        const result = await f.service.resume(task.id);
        expect(result.counts).toEqual({ success: 6, failed: 0, unknown: 0, unstarted: 0 });
        expect(result.task.state).toBe("complete");
        for (const movie of task.movies) expect(seen.filter(([id]) => id === movie.videoId).map(([, id]) => id)).toEqual(["list-a", "list-b"]);
        expect(f.state.maximum).toBeLessThanOrEqual(2);
        expect(f.adapter.setListMember).toHaveBeenCalledTimes(6);
        expect(JSON.stringify([...f.data])).not.toContain("fixture-csrf");
        expect(JSON.stringify([...f.data])).not.toContain('"identity"');
    });

    it("reads the whole paginated directory, rejecting loops and inconsistent duplicate rows", async () => {
        const f = fixture();
        f.adapter.readListPage.mockResolvedValueOnce({ lists: [{ ...lists[0], checked: true }], nextUrl: `${origin}/users/simple_lists?page=2&vid=movie-1` }).mockResolvedValueOnce({ lists: [{ ...lists[1], checked: false }], nextUrl: null });
        expect(await f.service.directory({ origin }, "movie-1")).toHaveLength(2);
        f.adapter.readListPage.mockResolvedValue({ lists: [], nextUrl: `${origin}/users/simple_lists?vid=movie-1` });
        await expect(f.service.directory({ origin }, "movie-1")).rejects.toThrow("分页不完整");
        f.adapter.readListPage.mockResolvedValueOnce({ lists: [{ ...lists[0], checked: true }], nextUrl: `${origin}/users/simple_lists?page=2` }).mockResolvedValueOnce({ lists: [{ ...lists[0], checked: false }], nextUrl: null });
        await expect(f.service.directory({ origin }, "movie-1")).rejects.toThrow("分页状态");
    });

    it("provides read-only access without a reliable account or Web Locks", async () => {
        const anonymous = fixture({ account: null });
        expect(await anonymous.service.access()).toMatchObject({ writable: false, account: null });
        await expect(anonymous.create()).rejects.toMatchObject({ code: "LIST_READ_ONLY" });
        const unsupported = fixture({ sharedLocks: null });
        expect(await unsupported.service.access()).toMatchObject({ writable: false });
        expect(await unsupported.service.directory({ origin }, null)).toHaveLength(2);
        await expect(unsupported.create()).rejects.toMatchObject({ code: "LIST_READ_ONLY" });
        expect(unsupported.adapter.setListMember).not.toHaveBeenCalled();
    });

    it("sends no membership request when the intent prewrite fails", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]);
        const write = f.storage.set.getMockImplementation();
        f.storage.set.mockImplementation(async (key, value) => { if (key.includes(`${task.id}/`)) throw new Error("intent failed"); return write(key, value); });
        await expect(f.service.resume(task.id)).rejects.toThrow("intent failed");
        expect(f.adapter.readListPage).not.toHaveBeenCalled();
        expect(f.adapter.setListMember).not.toHaveBeenCalled();
        expect((await f.service.inspect(task)).counts.unstarted).toBe(1);
    });

    it("skips a submission when the authoritative membership already reaches the goal", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]);
        f.server.set("movie-1/list-a", true);
        f.adapter.readListPage.mockResolvedValue({ lists: [{ ...lists[0], checked: true, disabled: true }], nextUrl: null });
        expect((await f.service.resume(task.id)).counts.success).toBe(1);
        expect(f.adapter.setListMember).not.toHaveBeenCalled();
    });

    it("verifies a server commit after its response is lost and never counts an unverified acceptance as success", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]);
        f.adapter.setListMember.mockImplementationOnce(async (_origin, input) => { f.server.set(`${input.videoId}/${input.listId}`, true); throw new Error("response lost"); });
        expect((await f.service.resume(task.id)).counts.success).toBe(1);
        const other = await f.create([movies[1]], [lists[0]]);
        f.adapter.setListMember.mockResolvedValueOnce("accepted");
        const result = await f.service.resume(other.id);
        expect(result.counts).toMatchObject({ success: 0, unknown: 1 });
        expect(result.task.state).toBe("needs-review");
    });

    it("retains an uncertain result after failed verification, then recovers from fresh server state without another POST", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]);
        const read = f.adapter.readListPage.getMockImplementation();
        f.adapter.readListPage.mockImplementationOnce(read).mockRejectedValueOnce(new Error("offline"));
        expect((await f.service.resume(task.id)).counts.unknown).toBe(1);
        const recovered = new JavDbListService({ storage: f.storage, integrations: { getAdapter: () => f.adapter }, context: f.context, locks: f.sharedLocks });
        expect((await recovered.listTasks())[0].id).toBe(task.id);
        expect((await recovered.resume(task.id)).counts.success).toBe(1);
        expect(f.adapter.setListMember).toHaveBeenCalledOnce();
    });

    it("pauses on an account switch before POST and requires the original account on recovery", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]);
        f.adapter.readListPage.mockImplementationOnce(async () => { f.state.account = "user-b"; return { lists: [{ ...lists[0], checked: false }], nextUrl: null }; });
        const result = await f.service.resume(task.id);
        expect(result.task.state).toBe("account-changed");
        expect(result.counts.unknown).toBe(1);
        expect(f.adapter.setListMember).not.toHaveBeenCalled();
        await expect(f.service.resume(task.id)).rejects.toMatchObject({ code: "LIST_ACCOUNT_CHANGED" });
        f.state.account = "user-a";
        expect((await f.service.resume(task.id)).counts.success).toBe(1);
    });

    it("does not mark a result successful when the account switches during submission", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]);
        f.adapter.setListMember.mockImplementationOnce(async () => { f.server.set("movie-1/list-a", true); f.state.account = "user-b"; return "accepted"; });
        const result = await f.service.resume(task.id);
        expect(result.counts).toMatchObject({ success: 0, unknown: 1 });
        expect(result.task.state).toBe("account-changed");
    });

    it("stops scheduling but waits for dispatched mutations and their verification", async () => {
        const f = fixture(), task = await f.create();
        f.state.stopGate = defer();
        const running = f.service.resume(task.id);
        await vi.waitFor(() => expect(f.adapter.setListMember).toHaveBeenCalledTimes(2));
        let stopped = false;
        const stop = f.service.stop(task.id).then(() => { stopped = true; });
        await Promise.resolve();
        expect(stopped).toBe(false);
        f.state.stopGate.resolve();
        await stop;
        const result = await running;
        expect(result.counts).toEqual({ success: 2, failed: 0, unknown: 0, unstarted: 4 });
        expect(f.adapter.setListMember).toHaveBeenCalledTimes(2);
        expect(result.task.state).toBe("stopped");
        expect((await f.service.resume(task.id)).counts.success).toBe(6);
    });

    it("honors stop while the task metadata is still loading", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]), gate = defer();
        const get = f.storage.get.getMockImplementation();
        f.storage.get.mockImplementationOnce(async key => { await gate.promise; return get(key); });
        const before = f.adapter.readWebAccount.mock.calls.length;
        const running = f.service.resume(task.id), stopped = f.service.stop(task.id);
        gate.resolve();
        await stopped;
        expect((await running).task.state).toBe("stopped");
        expect(f.adapter.readWebAccount).toHaveBeenCalledTimes(before);
        expect(f.adapter.setListMember).not.toHaveBeenCalled();
    });

    it("locks a task across tabs and serializes the same movie/list pair across different tasks", async () => {
        const f = fixture(), first = await f.create([movies[0]], [lists[0]]), second = await f.create([movies[0]], [lists[0]]);
        f.state.stopGate = defer();
        const other = new JavDbListService({ storage: f.storage, integrations: { getAdapter: () => f.adapter }, context: f.context, locks: f.sharedLocks });
        const running = f.service.resume(first.id);
        await vi.waitFor(() => expect(f.adapter.setListMember).toHaveBeenCalledOnce());
        await expect(other.resume(first.id)).rejects.toMatchObject({ code: "LIST_TASK_BUSY" });
        const waiting = other.resume(second.id);
        await new Promise(resolve => setTimeout(resolve, 15));
        expect(f.adapter.setListMember).toHaveBeenCalledOnce();
        f.state.stopGate.resolve();
        await Promise.all([running, waiting]);
        expect(f.adapter.setListMember).toHaveBeenCalledOnce();
    });

    it("recovers a failed result persistence by reading the server before deciding to submit again", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]), write = f.storage.set.getMockImplementation();
        let failed = false;
        f.storage.set.mockImplementation(async (key, value) => { if (value.state === "success" && !failed) { failed = true; throw new Error("result write failed"); } return write(key, value); });
        const result = await f.service.resume(task.id);
        expect(result.counts.unknown).toBe(1);
        expect((await f.service.resume(task.id)).counts.success).toBe(1);
        expect(f.adapter.setListMember).toHaveBeenCalledOnce();
    });

    it("rejects corrupt or future task identities and an unconfirmed account before membership writes", async () => {
        const f = fixture(), task = await f.create([movies[0]], [lists[0]]);
        await expect(f.service.createTask({ movies, lists, checked: true, expectedAccount: "old-account" })).rejects.toMatchObject({ code: "LIST_ACCOUNT_CHANGED" });
        const key = `jhs_javdb_list_task_v1:${task.id}`;
        f.data.set(key, { ...task, schema: 2 });
        await expect(f.service.resume(task.id)).rejects.toThrow("版本或格式");
        f.data.set(key, { ...task, movies: [{ ...task.movies[0], videoId: "different" }] });
        await expect(f.service.resume(task.id)).rejects.toThrow("身份不一致");
        expect(f.adapter.setListMember).not.toHaveBeenCalled();
        f.data.set(key, task);
        f.state.origin = "https://javdb999.com";
        await expect(f.service.resume(task.id)).rejects.toMatchObject({ code: "LIST_READ_ONLY" });
    });
});
