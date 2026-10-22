// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { WebDavClient } from "../src/services/webdav-service.js";
import { SYNC_FOLDER, syncFileName } from "../src/core/webdav-sync-model.js";

const id = "01234567-1234-1234-1234-012345678901", name = syncFileName(id, 1, "2026-10-22T00:00:00.000Z", "a".repeat(64));
const path = `/dav/${encodeURIComponent(SYNC_FOLDER)}/`;
const entry = (href, extra = "", type = "<d:resourcetype/>") => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${type}<d:displayname>fake.json</d:displayname></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>${extra}</d:response>`;
const fixture = body => {
    const http = { request: vi.fn(async () => ({ status: 207, data: `<d:multistatus xmlns:d="DAV:">${body}</d:multistatus>` })) };
    return { http, client: new WebDavClient(http, "https://dav.test/dav", "u", "synthetic") };
};
describe("strict immutable snapshot DAV transport", () => {
    it("uses actual href, file type and exact target directory instead of displayname", async () => {
        const { client, http } = fixture(entry(path) + entry(path + name));
        expect((await client.listSyncFiles())[0]).toMatchObject({ name, replicaId: id, seq: 1 });
        expect(http.request.mock.calls[0][0]).toMatchObject({ method: "PROPFIND", cacheScope: "none", headers: { Depth: "1", "Cache-Control": "no-cache" } });
    });
    it.each([path + "nested/" + name, "https://other.test" + path + name, "/outside/" + name, path + name + "?x=1", path + "%2f" + name])("rejects anomalous path %s", async href => {
        await expect(fixture(entry(href)).client.listSyncFiles()).rejects.toThrow();
    });
    it("rejects unsupported versions, duplicate hrefs, malformed managed names and missing file type", async () => {
        for (const body of [entry(path + name.replace("sync_v1_", "sync_v2_")), entry(path + name, "<d:href>other</d:href>"), entry(path + "sync_v1_bad.json"), entry(path + name, "", "<d:resourcetype><d:collection/></d:resourcetype>")]) await expect(fixture(body).client.listSyncFiles()).rejects.toThrow();
    });
    it("supports missing-file reads and refuses deleting another replica", async () => {
        const { client, http } = fixture(""); http.request.mockResolvedValue({ status: 404, responseText: "missing" });
        expect(await client.readSyncFile(name, true)).toBeNull();
        await expect(client.deleteSyncFile(name, "other")).rejects.toThrow("其他副本");
        expect(http.request).toHaveBeenCalledOnce();
    });
});
