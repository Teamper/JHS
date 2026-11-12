import { expect, it, vi } from "vitest";
import { createMediaLibraryAdapter } from "../../src/integrations/media-library/manifest.js";
import { matchesMediaItem, normalizeMediaConnection, mediaApiUrl, MediaConnectionValidationError, mediaConnectionErrorLabel } from "../../src/core/media-library-model.js";
import { readFile } from "node:fs/promises";

const connection = { id: "a", name: "本机", type: "jellyfin", address: "https://server.example/library/", apiKey: "fixture-api-key", userId: "user-a", enabled: true };
const fixture = JSON.parse(await readFile(new URL("../fixtures/integrations/media-library/items.json", import.meta.url), "utf8"));
it("reads the documented item envelope and metadata fields", async () => {
    const adapter = createMediaLibraryAdapter({ request: async () => ({ data: fixture }) });
    const result = await adapter.readPage(connection, { offset: 0 });
    expect(result).toEqual({ total: 2, items: fixture.Items });
    expect(result.items.filter(item => matchesMediaItem(item, "ABC-123"))).toHaveLength(1);
});

it.each(["jellyfin", "emby"])("uses %s header auth, exact redirect target and proxy prefix", async type => {
    const request = vi.fn(async options => ({ data: options.url.includes("System/Info") ? { Id: "server-a" } : { Items: [], TotalRecordCount: 0 } }));
    const adapter = createMediaLibraryAdapter({ request });
    const profile = normalizeMediaConnection({ ...connection, type });
    expect(await adapter.serverInfo(profile)).toEqual({ id: "server-a", name: "本机" });
    await adapter.readPage(profile, { offset: 20 });
    const options = request.mock.calls[1][0], url = new URL(options.url);
    expect(url.pathname).toBe(type === "emby" ? "/library/emby/Items" : "/library/Items");
    expect(url.searchParams.get(type === "emby" ? "UserId" : "userId")).toBe("user-a");
    expect(url.searchParams.get(type === "emby" ? "StartIndex" : "startIndex")).toBe("20");
    expect(url.searchParams.get(type === "emby" ? "Fields" : "fields")).toContain("Path");
    expect(options.headers).toEqual(type === "emby" ? { "X-Emby-Token": connection.apiKey } : { Authorization: `MediaBrowser Token="${connection.apiKey}"` });
    expect(options).toMatchObject({ requestOptions: { anonymous: true, redirect: "error", fetch: true }, retryCount: 0, urlPolicy: { trustClass: "user-local", expectedOrigin: url.origin, expectedUrl: url.href } });
    expect(options.url).not.toContain(connection.apiKey);
});
it("avoids adding Emby's prefix twice and preserves nested reverse proxy paths", () => {
    for (const suffix of ["emby/", "mediabrowser/"]) expect(mediaApiUrl({ ...connection, type: "emby", address: `https://server.example/a/${suffix}` }, "Items").pathname).toBe(`/a/${suffix}Items`);
    expect(mediaApiUrl({ ...connection, type: "emby", address: "https://server.example/emby-proxy/" }, "Items").pathname).toBe("/emby-proxy/emby/Items");
});
it.each(["https://user:key@server.example/path", "https://server.example/path?api_key=token", "https://server.example/path#token", "file:///private", "https://server.example/a/%2e%2e/", "https://server.example/a%2fb/"])("rejects ambiguous or credential-bearing address %s", address => {
    expect(() => normalizeMediaConnection({ ...connection, address })).toThrow();
});
it.each([
    ["192.168.100.217:8096", "http://192.168.100.217:8096/"],
    ["media.example:8096/proxy", "http://media.example:8096/proxy/"],
    ["localhost:8096", "http://localhost:8096/"],
    ["[::1]:8096", "http://[::1]:8096/"],
    ["https://media.example/proxy", "https://media.example/proxy/"],
])("normalizes a media server address %s", (address, expected) => {
    expect(normalizeMediaConnection({ ...connection, address }).address).toBe(expected);
});
it.each(['key"injection', "key\r\ninjection", "key\\injection"])("rejects invalid header credentials", apiKey => {
    expect(() => normalizeMediaConnection({ ...connection, apiKey })).toThrow();
});
it("uses name, original title, sources, provider IDs and complete FC2 identity", () => {
    expect(matchesMediaItem({ OriginalTitle: "ABC-123 标题" }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ ProviderIds: { javdb: "ABC-123" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ MediaSources: [{ Path: "/ABC123.mp4" }] }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "ABC-1234" }, "ABC-123")).toBe(false);
    expect(matchesMediaItem({ Name: "FC2-PPV-12345678" }, "FC2-1234567")).toBe(false);
});
it("keeps standard catalog IDs and NAS directory names separate from movie codes", () => {
    expect(matchesMediaItem({ Name: "ABC-123", Path: "\\\\NAS01\\JAV2023\\ABC123.mp4", ProviderIds: { Imdb: "tt1234567", Tmdb: "12345", Javdb: "opaque-id" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", Path: "/NAS01/ABC-123/影片.mkv", ProviderIds: { Imdb: "tt1234567" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { Imdb: "tt1234567" } }, "TT-1234567")).toBe(false);
});
it("keeps filename/title conflicts authoritative and uses the nearest numbered movie folder", () => {
    expect(matchesMediaItem({ Name: "ABC-123", Path: "/ABC-123/ABC-124.mp4" }, "ABC-123")).toBe(false);
    expect(matchesMediaItem({ Name: "本地译名", Path: "/ABC-123/ABC-124/影片.mkv" }, "ABC-123")).toBe(false);
    expect(matchesMediaItem({ Name: "本地译名", Path: "https://media.example/videos/ABC-123/影片.mkv?token=unrelated123" }, "ABC-123")).toBe(true);
});
it("uses explicitly named code fields and exact FC2 numeric IDs", () => {
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { MovieCode: "ABC123" } }, "ABC-123")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { FC2: "1234567" } }, "FC2-1234567")).toBe(true);
    expect(matchesMediaItem({ Name: "本地译名", ProviderIds: { FC2: "12345678" } }, "FC2-1234567")).toBe(false);
});

it.each([
    [{ name: "" }, "name", "请填写服务器名称"],
    [{ name: "x".repeat(101) }, "name", "服务器名称不能超过"],
    [{ address: "" }, "address", "请填写服务器地址"],
    [{ address: "http://" }, "address", "服务器地址格式无效"],
    [{ address: "ftp://server.example/" }, "address", "仅支持 HTTP/HTTPS"],
    [{ apiKey: "" }, "apiKey", "请填写 API Key"],
    [{ apiKey: "bad key" }, "apiKey", "API Key 格式无效"],
    [{ userId: "bad/user" }, "userId", "用户 ID 仅支持"],
])("reports the invalid media field %j", (patch, field, message) => {
    let failure;
    try { normalizeMediaConnection({ ...connection, ...patch }); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(MediaConnectionValidationError);
    expect(failure.field).toBe(field);
    expect(mediaConnectionErrorLabel(failure)).toContain(message);
});

it.each([
    [{ code: "AUTH_REQUIRED", details: { status: 401 } }, "认证失败（HTTP 401）"],
    [{ code: "AUTH_REQUIRED", details: { status: 403 } }, "服务器拒绝访问（HTTP 403）"],
    [{ code: "NOT_FOUND" }, "接口不存在（HTTP 404）"],
    [{ code: "NETWORK_ERROR", details: { status: 503 } }, "服务器响应异常（HTTP 503）"],
    [{ code: "TIMEOUT" }, "连接超时"],
    [{ code: "NETWORK_ERROR" }, "网络请求失败"],
    [{ code: "RATE_LIMITED" }, "HTTP 429"],
    [{ code: "ABORTED" }, "连接测试已取消"],
    [{ code: "CIRCUIT_OPEN" }, "连续请求失败"],
    [{ code: "INVALID_URL" }, "请求地址校验失败"],
    [{ code: "INVALID_RESPONSE", details: { stage: "identity" } }, "服务器身份响应格式无效"],
    [{ code: "INVALID_RESPONSE", details: { stage: "catalog" } }, "媒体目录响应格式无效"],
    [{ code: "RESPONSE_TOO_LARGE" }, "服务器响应超过允许大小"],
    [{ code: "UNSUPPORTED" }, "当前环境不支持"],
    [{ code: "NETWORK_ERROR", details: { status: 400 } }, "服务器拒绝请求（HTTP 400）"],
    [{ code: "constructor" }, "未知错误"],
    [{}, "未知错误"],
])("labels request failures without exposing upstream text %j", (properties, message) => {
    const failure = Object.assign(new Error("secret-api-key https://private.example/?token=secret <html>upstream</html>"), properties);
    const label = mediaConnectionErrorLabel(failure);
    expect(label).toContain(message);
    expect(label).not.toMatch(/secret|private\.example|<html>/);
});

it("identifies invalid server identity and catalog envelopes", async () => {
    const adapter = createMediaLibraryAdapter({ request: async () => ({ data: {} }) });
    await expect(adapter.serverInfo(connection)).rejects.toMatchObject({ code: "INVALID_RESPONSE", details: { stage: "identity" } });
    await expect(adapter.readPage(connection, { offset: 0 })).rejects.toMatchObject({ code: "INVALID_RESPONSE", details: { stage: "catalog" } });
});
