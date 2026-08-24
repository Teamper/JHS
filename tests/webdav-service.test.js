// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
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

it("parses portable WebDAV file metadata without exposing credentials", async () => {
    const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/dav/JHS/</d:href><d:propstat><d:prop><d:getcontentlength>0</d:getcontentlength></d:prop></d:propstat></d:response>
        <d:response><d:href>/dav/JHS/a.json</d:href><d:propstat><d:prop><d:displayname>a.json</d:displayname><d:getcontentlength>42</d:getcontentlength><d:getlastmodified>today</d:getlastmodified></d:prop></d:propstat></d:response>
    </d:multistatus>`;
    const request = vi.fn(async options => ({ data: options.method === "PROPFIND" ? xml : "" }));
    const client = new WebDavService({ request }).createClient({ url: "https://dav.example/base", username: "u", password: "p" });
    await expect(client.getBackupList("JHS")).resolves.toEqual([{ fileId: "a.json", name: "a.json", size: 42, createTime: "today" }]);
});
