// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { HttpService } from "../src/services/http-service.js";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";
import { WebDavService } from "../src/services/webdav-service.js";

function downloadFixture(responses) {
    const request = vi.fn(options => {
        const response = responses[request.mock.calls.length - 1];
        options.onload({ status: 200, responseText: "portable-backup", finalUrl: options.url, ...response });
        return { abort: vi.fn() };
    });
    const policy = new ExternalUrlPolicy({ localOrigins: ["https://dav.example.test"] });
    const http = new HttpService(new UserscriptHttpAdapter(request), policy);
    const client = new WebDavService(http).createClient({ url: "https://dav.example.test/dav", username: "user", password: "pass" });
    client.folderName = "JHS";
    return { request, client };
}

it("returns a direct backup download as a string using manual redirects", async () => {
    const { client, request } = downloadFixture([{}]);
    await expect(client.getFileContent("backup.json")).resolves.toBe("portable-backup");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ redirect: "manual", timeout: 10_000, headers: { Authorization: `Basic ${btoa("user:pass")}`, Depth: "1", Accept: "application/octet-stream" } }));
});

it.each([301, 302, 303, 307, 308])("follows a relative same-origin %i download redirect with existing authentication", async status => {
    const { client, request } = downloadFixture([{ status, responseHeaders: "lOcAtIoN: ../download.json\r\n" }, {}]);
    await expect(client.getFileContent("backup.json")).resolves.toBe("portable-backup");
    expect(request.mock.calls[1][0]).toMatchObject({ url: "https://dav.example.test/dav/download.json", method: "GET", headers: { Authorization: `Basic ${btoa("user:pass")}`, Depth: "1" } });
});

it("isolates every public CDN hop and never restores credentials on returning to the origin", async () => {
    const { client, request } = downloadFixture([
        { status: 301, responseHeaders: "Location: https://cdn.example.test/one?signature=fixture" },
        { status: 307, responseHeaders: "Location: https://other.example.test/two" },
        { status: 302, responseHeaders: "Location: https://dav.example.test/dav/returned.json" }, {},
    ]);
    await expect(client.getFileContent("backup.json")).resolves.toBe("portable-backup");
    expect(request).toHaveBeenCalledTimes(4);
    for (const [options] of request.mock.calls.slice(1)) {
        expect(options).toMatchObject({ method: "GET", anonymous: true, redirect: "manual", headers: { Accept: "application/octet-stream" } });
        expect(Object.keys(options.headers)).toEqual(["Accept"]);
        expect(options).not.toHaveProperty("cookie");
        expect(options).not.toHaveProperty("user");
        expect(options).not.toHaveProperty("password");
    }
});

it.each(["http://cdn.example.test/file", "https://127.0.0.1/file", "https://192.168.1.1/file", "https://[::1]/file", "https://localhost/file", "https://user:pass@cdn.example.test/file", "https://user@dav.example.test/file", "file:///backup", "https://["])("rejects unsafe download target %s before sending a second request", async location => {
    const { client, request } = downloadFixture([{ status: 301, responseHeaders: `Location: ${location}` }]);
    await expect(client.getFileContent("backup.json")).rejects.toMatchObject({ code: "INVALID_URL" });
    expect(request).toHaveBeenCalledOnce();
});

it.each([{ status: 301 }, { status: 0 }, { status: 304 }])("rejects an unreadable redirect or invalid status $status", async response => {
    const { client, request } = downloadFixture([response]);
    await expect(client.getFileContent("backup.json")).rejects.toThrow();
    expect(request).toHaveBeenCalledOnce();
});

it("rejects redirect loops without requesting the repeated URL", async () => {
    const { client, request } = downloadFixture([{ status: 301, responseHeaders: "Location: backup.json#ignored" }]);
    await expect(client.getFileContent("backup.json")).rejects.toThrow("循环");
    expect(request).toHaveBeenCalledOnce();
});

it("allows five redirects and refuses a sixth", async () => {
    const redirects = Array.from({ length: 6 }, (_, index) => ({ status: 301, responseHeaders: `Location: https://cdn.example.test/hop-${index}` }));
    const allowed = downloadFixture([...redirects.slice(0, 5), {}]);
    await expect(allowed.client.getFileContent("backup.json")).resolves.toBe("portable-backup");
    const blocked = downloadFixture(redirects);
    await expect(blocked.client.getFileContent("backup.json")).rejects.toThrow("超过限制");
    expect(blocked.request).toHaveBeenCalledTimes(6);
});

it("keeps final-origin checks when the transport ignores manual redirects", async () => {
    const { client, request } = downloadFixture([{ finalUrl: "https://cdn.example.test/file" }]);
    await expect(client.getFileContent("backup.json")).rejects.toMatchObject({ code: "INVALID_URL" });
    expect(request).toHaveBeenCalledOnce();
});

it.each(["MKCOL", "PROPFIND", "PUT", "DELETE"])("continues rejecting a cross-origin final URL for %s", async method => {
    const { client, request } = downloadFixture([{ finalUrl: "https://cdn.example.test/file" }]);
    await expect(client.request(method, "JHS/file")).rejects.toMatchObject({ code: "INVALID_URL" });
    expect(request.mock.calls[0][0].redirect).toBeUndefined();
});

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
        <d:response><d:href>/dav/JHS/</d:href><d:propstat><d:prop><d:getcontentlength>0</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
        <d:response><d:href>/dav/JHS/a.json</d:href><d:propstat><d:prop><d:resourcetype/><d:displayname>a.json</d:displayname><d:getcontentlength>42</d:getcontentlength><d:getlastmodified>today</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
    </d:multistatus>`;
    const request = vi.fn(async options => ({ data: options.method === "PROPFIND" ? xml : "" }));
    const client = new WebDavService({ request }).createClient({ url: "https://dav.example/dav", username: "u", password: "p" });
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

it("treats special backup filenames as one encoded path segment for upload, download and delete", async () => {
    const request = vi.fn(async () => ({ status: 200, data: "backup" }));
    const client = new WebDavService({ request }).createClient({ url: "https://dav.example/dav", username: "u", password: "p" });
    client.folderName = "JHS";
    for (const name of ["备份 空格.json", "backup#1?.json", "literal%2Fname.json"]) {
        await client.backup("JHS", name, "payload");
        await client.getFileContent(name);
        await client.deleteFile(name);
        const paths = request.mock.calls.slice(-3).map(([options]) => new URL(options.url));
        expect(paths.map(url => url.pathname)).toEqual(Array(3).fill(`/dav/JHS/${encodeURIComponent(name)}`));
        expect(paths.every(url => !url.hash && !url.search)).toBe(true);
    }
});

it("rejects directory-like backup filenames before any download, delete or upload request", async () => {
    const request = vi.fn(async () => ({ status: 200, data: "backup" }));
    const client = new WebDavService({ request }).createClient({ url: "https://dav.example/dav", username: "u", password: "p" });
    client.folderName = "JHS";
    for (const name of ["", ".", "..", "nested/name.json", "nested\\name.json"]) {
        await expect(client.getFileContent(name)).rejects.toMatchObject({ code: "INVALID_URL" });
        await expect(client.deleteFile(name)).rejects.toMatchObject({ code: "INVALID_URL" });
        await expect(client.backup("JHS", name, "payload")).rejects.toMatchObject({ code: "INVALID_URL" });
    }
    expect(request).not.toHaveBeenCalled();
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
