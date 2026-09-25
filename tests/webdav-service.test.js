// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { HttpService } from "../src/services/http-service.js";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";
import { WebDavService } from "../src/services/webdav-service.js";

it("routes WebDAV requests through HttpService with an exact user-local origin", async () => {
    const request = vi.fn(async () => ({ data: "" }));
    const client = new WebDavService({ request }).createClient({ url: "http://192.168.1.10:5244/dav", username: "user", password: "pass" });
    await client.backup("JHS", "backup.json", "payload");
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
        providerId: "webdav", method: "MKCOL", url: "http://192.168.1.10:5244/dav/JHS",
        cacheScope: "none", urlPolicy: { trustClass: "user-local", expectedOrigin: "http://192.168.1.10:5244" },
    }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
        method: "PUT", body: "payload", headers: expect.objectContaining({ Authorization: `Basic ${btoa("user:pass")}` }),
    }));
});

it("keeps uploading when the folder already exists on repeated backups", async () => {
    const request = vi.fn(async (options) => ({ status: options.method === "MKCOL" ? 405 : 200, data: "", finalUrl: options.url }));
    const client = new WebDavService({ request }).createClient({ url: "https://dav.example/base", username: "u", password: "p" });
    await client.backup("JHS", "one.json", "one");
    await client.backup("JHS", "two.json", "two");
    await client.backup("JHS", "three.json", "three");
    expect(request.mock.calls.filter(([options]) => options.method === "MKCOL")).toHaveLength(3);
    expect(request.mock.calls.filter(([options]) => options.method === "PUT")).toHaveLength(3);
    expect(request.mock.calls.every(([options]) => options.method !== "MKCOL" || options.acceptableStatuses?.join(",") === "405,409")).toBe(true);
});

it("parses portable WebDAV file metadata without exposing credentials", async () => {
    const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/dav/JHS/</d:href><d:propstat><d:prop><d:getcontentlength>0</d:getcontentlength></d:prop></d:propstat></d:response>
        <d:response><d:href>/dav/JHS/a.json</d:href><d:propstat><d:prop><d:displayname>a.json</d:displayname><d:getcontentlength>42</d:getcontentlength><d:getlastmodified>today</d:getlastmodified></d:prop></d:propstat></d:response>
    </d:multistatus>`;
    const request = vi.fn(async options => ({ data: options.method === "PROPFIND" ? xml : "" }));
    const client = new WebDavService({ request }).createClient({ url: "https://dav.example/base", username: "u", password: "p" });
    await expect(client.getBackupList("JHS")).resolves.toEqual([{ fileId: "a.json", name: "a.json", size: 42, createTime: "today" }]);
});

it("uses a 10-second WebDAV deadline without changing ordinary request settings", async () => {
    const calls = [];
    const adapter = new UserscriptHttpAdapter(options => {
        calls.push({ method: options.method, timeout: options.timeout });
        options.onload({ status: options.method === "MKCOL" ? 405 : 200, responseText: "", finalUrl: options.url });
        return { abort: vi.fn() };
    });
    const policy = new ExternalUrlPolicy({ localOrigins: ["https://dav.example.test"] });
    const http = new HttpService(adapter, policy, { settings: { snapshot: () => ({ httpTimeout: 5_000 }) } });
    const client = new WebDavService(http).createClient({ url: "https://dav.example.test/dav", username: "user", password: "pass" });
    await client.backup("JHS", "backup.json", "payload");
    await client.request("PROPFIND", "JHS");
    await client.request("GET", "JHS/backup.json");
    await client.request("DELETE", "JHS/backup.json");
    await http.request({ providerId: "ordinary", method: "GET", url: "https://api.example.test/data", cacheScope: "none", urlPolicy: { trustClass: "builtin-public", hosts: ["example.test"] } });
    expect(calls).toEqual([
        { method: "MKCOL", timeout: 10_000 }, { method: "PUT", timeout: 10_000 },
        { method: "PROPFIND", timeout: 10_000 }, { method: "GET", timeout: 10_000 },
        { method: "DELETE", timeout: 10_000 }, { method: "GET", timeout: 5_000 },
    ]);
});

it("accepts upload before its deadline and ignores a later timeout callback", async () => {
    vi.useFakeTimers();
    try {
        const stages = [], adapter = new UserscriptHttpAdapter(options => {
            if (options.method === "MKCOL") options.onload({ status: 405, responseText: "", finalUrl: options.url });
            else {
                setTimeout(() => options.onload({ status: 201, responseText: "", finalUrl: options.url }), 9_999);
                setTimeout(() => options.ontimeout(), 10_000);
            }
            return { abort: vi.fn() };
        });
        const http = new HttpService(adapter, new ExternalUrlPolicy({ localOrigins: ["https://dav.example.test"] }), { settings: { snapshot: () => ({ httpTimeout: 5_000 }) } });
        const client = new WebDavService(http).createClient({ url: "https://dav.example.test/dav", username: "u", password: "p" });
        const pending = client.backup("JHS", "backup.json", "payload", event => stages.push(event));
        await vi.advanceTimersByTimeAsync(9_999);
        await expect(pending).resolves.toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        expect(stages).toMatchObject([{ stage: "建目录", result: "success" }, { stage: "上传", result: "success", bytes: 7, timeoutMs: 10_000 }]);
    } finally { vi.useRealTimers(); }
});

it("reports upload timeout once and ignores a late success callback", async () => {
    vi.useFakeTimers();
    try {
        const stages = [], adapter = new UserscriptHttpAdapter(options => {
            if (options.method === "MKCOL") options.onload({ status: 405, responseText: "", finalUrl: options.url });
            else {
                setTimeout(() => options.ontimeout(), options.timeout);
                setTimeout(() => options.onload({ status: 201, responseText: "", finalUrl: options.url }), options.timeout + 1);
            }
            return { abort: vi.fn() };
        });
        const http = new HttpService(adapter, new ExternalUrlPolicy({ localOrigins: ["https://dav.example.test"] }), { settings: { snapshot: () => ({ httpTimeout: 5_000 }) } });
        const client = new WebDavService(http).createClient({ url: "https://dav.example.test/dav", username: "u", password: "p" });
        const rejected = expect(client.backup("JHS", "backup.json", "payload", event => stages.push(event))).rejects.toMatchObject({ code: "TIMEOUT" });
        await vi.advanceTimersByTimeAsync(10_000);
        await rejected;
        await vi.advanceTimersByTimeAsync(1);
        expect(stages).toMatchObject([{ stage: "建目录", result: "success" }, { stage: "上传", result: "error", code: "TIMEOUT", timeoutMs: 10_000 }]);
        expect(stages).toHaveLength(2);
    } finally { vi.useRealTimers(); }
});
