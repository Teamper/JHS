import { afterEach, expect, it, vi } from "vitest";
import { MediaLibraryService } from "../src/services/media-library-service.js";
import { MEDIA_CONNECTIONS_KEY } from "../src/core/media-library-model.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const first = { id: "one", name: "卧室", type: "jellyfin", address: "http://192.168.1.5/media/", apiKey: "fixture-key", userId: "", enabled: true };
const second = { ...first, id: "two", name: "客厅", type: "emby", address: "https://server.example/proxy/" };
const services = [];
afterEach(() => { for (const service of services.splice(0)) service.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });
function setup(connections = [first], overrides = {}) {
    let value = JSON.stringify(connections);
    const credential = Object.assign(new EventTarget(), { readEntry: vi.fn(async () => ({ value })), set: vi.fn(async (key, next) => { expect(key).toBe(MEDIA_CONNECTIONS_KEY); value = next; }) });
    const settings = Object.assign(new EventTarget(), { snapshot: () => ({ enableMediaLibrary: true }) });
    const adapter = { serverInfo: vi.fn(async connection => ({ id: `server-${connection.id}` })), readPage: vi.fn(async () => ({ total: 1, items: [{ Id: "movie-a", Name: "ABC-123 标题" }] })), ...overrides };
    const storage = { listenValue: vi.fn(), unlistenValue: vi.fn() }, urlPolicy = new ExternalUrlPolicy();
    const service = new MediaLibraryService({ integrations: { getAdapter: id => { expect(id).toBe("media-library"); return adapter; } }, credential, storage, settings, urlPolicy });
    services.push(service);
    return { service, adapter, credential, settings, urlPolicy };
}
it("defaults to no outgoing requests until enabled and configured", async () => {
    const { service, adapter, settings } = setup();
    settings.snapshot = () => ({ enableMediaLibrary: false });
    expect(await service.queryMovie({ carNum: "ABC-123" })).toMatchObject({ status: "unknown", hits: [] });
    expect(adapter.serverInfo).not.toHaveBeenCalled();
});
it("retains multiple server/version hits and emits progressive states", async () => {
    const { service } = setup([first, second]);
    const updates = [];
    const result = await service.queryMovie({ carNum: "ABC-123" }, { onUpdate: value => updates.push(value) });
    expect(updates[0].servers.map(server => server.status)).toEqual(["loading", "loading"]);
    expect(updates.some(result => result.servers.some(server => server.status === "loading") && result.status === "present")).toBe(true);
    expect(result.hits).toHaveLength(2);
    expect(result.hits[0].url).toBe("http://192.168.1.5/media/web/#/details?id=movie-a&serverId=server-one");
    expect(result.hits[1].url).toBe("https://server.example/proxy/web/index.html#!/item?id=movie-a&serverId=server-two");
    expect(JSON.stringify(result)).not.toContain(first.apiKey);
});
it("confirms absent only after all enabled servers finish successfully", async () => {
    const { service, adapter } = setup([first, second], { readPage: vi.fn(async () => ({ total: 0, items: [] })) });
    expect((await service.queryMovie({ carNum: "ABC-123" })).status).toBe("absent");
    service.invalidate();
    adapter.serverInfo.mockImplementation(async connection => { if (connection.id === second.id) throw Object.assign(new Error("secret-url"), { code: "AUTH_REQUIRED" }); return { id: "server" }; });
    const result = await service.queryMovie({ carNum: "ABC-123" });
    expect(result.status).toBe("unknown");
    expect(result.servers[1].error).toContain("认证失败");
    expect(JSON.stringify(result)).not.toContain("secret-url");
});
it("reads all pages and matches localized titles through exact path identity", async () => {
    const { service, adapter } = setup([first], { readPage: vi.fn(async (_connection, options) => options.offset === 0 ? { total: 3, items: [{ Id: "a", Name: "无番号", Path: "/films/ABC-124.mp4" }, { Id: "b", Name: "ABC-123", Path: "/films/ABC-123 ABC-999.mp4" }] } : { total: 3, items: [{ Id: "c", Name: "本地译名", Path: "/films/ABC123-CD1.mp4" }] }) });
    const result = await service.queryMovie({ carNum: "ABC-123" });
    expect(result.hits.map(hit => hit.itemId)).toEqual(["c"]);
    expect(adapter.readPage.mock.calls.map(([, options]) => options.offset)).toEqual([0, 2]);
});
it("indexes complete identity once and retains all versions without unrelated catalog metadata", async () => {
    const { service } = setup([first], { readPage: async () => ({ total: 3, items: [
        { Id: "a", Name: "ABC-123 版本一", Path: "\\\\NAS01\\JAV2023\\ABC123.mp4", ProviderIds: { Imdb: "tt1234567" }, MediaSources: [{ Path: "/ABC-123.mp4", ExtraMetadata: "unused" }] },
        { Id: "b", Name: "ABC-123 版本二", Path: "/ABC-123-CD2.mp4" },
        { Id: "c", Name: "ABC-124", Path: "/ABC-999.mp4" },
    ] }) });
    expect((await service.queryMovie({ carNum: "ABC-123" })).hits.map(hit => hit.itemId)).toEqual(["a", "b"]);
    const index = service.indexes.get(first.id);
    expect([...index.movies.keys()]).toEqual(["ABC123"]);
    expect(index.movies.get("ABC123")[0]).toEqual({ Id: "a", Name: "ABC-123 版本一", Path: "\\\\NAS01\\JAV2023\\ABC123.mp4" });
});
it("requires the complete FC2 number", async () => {
    const { service } = setup([first], { readPage: async () => ({ total: 2, items: [{ Id: "a", Path: "FC2-PPV-1234567.mp4" }, { Id: "b", Path: "FC2-PPV-12345678.mp4" }] }) });
    expect((await service.queryMovie({ carNum: "FC2-1234567" })).hits.map(hit => hit.itemId)).toEqual(["a"]);
});
it("shares one ten-minute server index across visible movies and refreshes explicitly", async () => {
    const { service, adapter } = setup();
    await Promise.all([service.queryMovie({ carNum: "ABC-123" }), service.queryMovie({ carNum: "ABC-124" })]);
    expect(adapter.readPage).toHaveBeenCalledOnce();
    await service.queryMovie({ carNum: "ABC-123" });
    expect(adapter.readPage).toHaveBeenCalledOnce();
    await service.queryMovie({ carNum: "ABC-123" }, { refresh: true });
    expect(adapter.readPage).toHaveBeenCalledTimes(2);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 600001);
    await service.queryMovie({ carNum: "ABC-123" });
    expect(adapter.readPage).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
});
it("limits all outgoing server requests to two", async () => {
    let active = 0, maximum = 0;
    const request = async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 8)); active--; return { id: "server" }; };
    const { service } = setup(Array.from({ length: 5 }, (_, index) => ({ ...first, id: `s${index}` })), { serverInfo: request });
    await service.queryMovie({ carNum: "ABC-123" });
    expect(maximum).toBe(2);
});
it("cancels consumers independently and rejects late cache writes after account/config changes", async () => {
    let finish, requestScope;
    const { service, adapter } = setup([first], { readPage: vi.fn((_connection, options) => { requestScope = options.scope; return new Promise(resolve => { finish = resolve; }); }) });
    const aScope = new LifecycleScope("a"), bScope = new LifecycleScope("b");
    const a = service.queryMovie({ carNum: "ABC-123" }, { scope: aScope }), b = service.queryMovie({ carNum: "ABC-124" }, { scope: bScope });
    const aRejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(adapter.readPage).toHaveBeenCalledOnce());
    aScope.dispose(); await aRejected;
    expect(requestScope.disposed).toBe(false);
    const bRejected = expect(b).rejects.toMatchObject({ name: "AbortError" });
    await service.saveConnections([{ ...first, apiKey: "replacement-key", userId: "other-user" }]);
    expect(requestScope.disposed).toBe(true);
    finish({ total: 1, items: [{ Id: "a", Name: "ABC-123" }] });
    await bRejected;
    expect(service.indexes.size).toBe(0);
    expect(service.results.size).toBe(0);
});
it("rejects repeated pagination and never labels an incomplete directory absent", async () => {
    const { service } = setup([first], { readPage: async () => ({ total: 3, items: [{ Id: "repeat", Name: "ABC-124" }] }) });
    expect((await service.queryMovie({ carNum: "ABC-123" })).status).toBe("unknown");
});
it("uses encrypted credentials and independent exact-origin leases", async () => {
    const { service, credential, urlPolicy } = setup();
    urlPolicy.authorizeLocalOrigin("http://localhost:8080");
    await service.initialize();
    expect(urlPolicy.assertAllowed(first.address, { trustClass: "user-local" }).origin).toBe("http://192.168.1.5");
    await service.saveConnections([{ ...second, enabled: true }]);
    expect(credential.set).toHaveBeenCalledOnce();
    expect(() => urlPolicy.assertAllowed(first.address, { trustClass: "user-local" })).toThrow();
    expect(urlPolicy.assertAllowed("http://localhost:8080", { trustClass: "user-local" }).origin).toBe("http://localhost:8080");
});
it("temporarily authorizes explicit connection tests and revokes after failure", async () => {
    const { service, adapter, urlPolicy } = setup([]);
    adapter.serverInfo.mockImplementation(async () => { expect(urlPolicy.assertAllowed(first.address, { trustClass: "user-local" })).toBeTruthy(); throw new Error("failed"); });
    await expect(service.testConnection(first, new LifecycleScope("test"))).rejects.toThrow("failed");
    expect(() => urlPolicy.assertAllowed(first.address, { trustClass: "user-local" })).toThrow();
});
it("keeps unreadable credentials in a stable unknown state until explicitly repaired", async () => {
    const { service, credential, adapter } = setup();
    credential.readEntry.mockRejectedValueOnce(new Error("unreadable ciphertext"));
    const result = await service.queryMovie({ carNum: "ABC-123" });
    expect(result).toMatchObject({ status: "unknown", servers: [{ status: "error" }] });
    await service.queryMovie({ carNum: "ABC-123" });
    expect(credential.readEntry).toHaveBeenCalledOnce();
    expect(adapter.readPage).not.toHaveBeenCalled();
    await expect(service.saveConnections([])).rejects.toThrow("无法读取");
    expect(credential.set).not.toHaveBeenCalled();
    await service.reload();
    await service.saveConnections([first]);
    expect((await service.queryMovie({ carNum: "ABC-123" })).status).toBe("present");
});

it("revokes a connection test grant immediately when its owner closes", async () => {
    let finish;
    const { service, adapter, urlPolicy } = setup([], { serverInfo: vi.fn(() => new Promise(resolve => { finish = resolve; })) });
    const scope = new LifecycleScope("closing-test");
    const pending = service.testConnection(first, scope);
    await vi.waitFor(() => expect(adapter.serverInfo).toHaveBeenCalledOnce());
    scope.dispose();
    expect(() => urlPolicy.assertAllowed(first.address, { trustClass: "user-local" })).toThrow();
    finish({ id: "server" });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(adapter.readPage).not.toHaveBeenCalled();
});
