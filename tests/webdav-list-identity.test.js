// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { WebDavClient } from "../src/services/webdav-service.js";

const entry = (href, name = "", properties = "<d:resourcetype/>", status = "200 OK") => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${properties}<d:displayname>${name}</d:displayname><d:getcontentlength>12</d:getcontentlength></d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`;
const listing = body => `<d:multistatus xmlns:d="DAV:">${body}</d:multistatus>`;
function fixture(xml) {
    const request = vi.fn(async options => ({ status: 200, data: options.method === "PROPFIND" ? xml : "", finalUrl: options.url }));
    return { request, client: new WebDavClient({ request }, "https://dav.example/dav", "synthetic", "synthetic") };
}

describe("manual WebDAV backup file identity", () => {
    it("keeps the first file, ignores unordered collections, and uses href for GET and DELETE", async () => {
        const { client, request } = fixture(listing(entry("/dav/JHS/actual.json", "different.json") + entry("/dav/JHS/", "JHS", "<d:resourcetype><d:collection/></d:resourcetype>") + entry("/dav/JHS/different.json", "Visible name")));
        const files = await client.getBackupList("JHS");
        expect(files.map(file => file.fileId)).toEqual(["different.json", "actual.json"]);
        const selected = files.find(file => file.fileId === "actual.json");
        expect(selected.name).toBe("different.json");
        await client.getFileContent(selected.fileId);
        expect(request.mock.calls.at(-1)[0]).toMatchObject({ method: "GET", url: "https://dav.example/dav/JHS/actual.json" });
        await client.deleteFile(selected.fileId);
        expect(request.mock.calls.at(-1)[0]).toMatchObject({ method: "DELETE", url: "https://dav.example/dav/JHS/actual.json" });
    });
    it("decodes a filename once while rejecting paths outside the selected directory", async () => {
        const { client } = fixture(listing([
            entry("/dav/JHS/%E4%B8%AD%E6%96%87%20%23%25.json"), entry("https://evil.example/dav/JHS/a.json"),
            entry("/dav/other.json"), entry("/dav/JHS/sub/a.json"), entry("/dav/JHS/a%2Fb.json"),
            entry("/dav/JHS/a.json?token=synthetic"), entry("/dav/JHS/bad%zz.json"),
            entry("/dav/JHS/not-found.json", "", "<d:resourcetype/>", "404 Not Found"),
        ].join("")));
        await expect(client.getBackupList("JHS")).resolves.toEqual([expect.objectContaining({ fileId: "中文 #%.json", name: "中文 #%.json" })]);
    });
    it("rejects malformed XML instead of presenting an empty successful list", async () => {
        await expect(fixture("<not-xml").client.getBackupList("JHS")).rejects.toThrow("列表格式无效");
    });
    it("rejects a collection even when another successful property block claims an empty type", async () => {
        const conflicting = entry("/dav/JHS/directory", "folder", "<d:resourcetype><d:collection/></d:resourcetype>")
            .replace("</d:response>", "<d:propstat><d:prop><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>");
        await expect(fixture(listing(conflicting)).client.getBackupList("JHS")).resolves.toEqual([]);
    });
});
