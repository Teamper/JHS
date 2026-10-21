// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { WebDavService } from "../src/services/webdav-service.js";
import { autoBackupFileName } from "../src/core/auto-backup-policy.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const source = "01234567-1234-1234-1234-012345678901";
const other = "01234567-1234-1234-1234-012345678902";
const name = autoBackupFileName(source, Date.UTC(2026, 9, 21));
const entry = (href, properties = "<d:resourcetype/>", status = "200 OK", displayname = "") => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${properties}<d:displayname>${displayname}</d:displayname></d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`;
const xml = entries => `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${entries.join("")}</d:multistatus>`;
function fixture(body) {
    const request = vi.fn(async () => ({ data: body }));
    const client = new WebDavService({ request }).createClient({ url: "https://dav.example/dav", username: "synthetic", password: "synthetic" });
    return { client, request };
}

describe("destructive automatic backup retention", () => {
    it("uses a direct child href even when the directory is not the first response", async () => {
        const f = fixture(xml([entry(`/dav/JHS/${name}`, undefined, undefined, "untrusted-display.json"), entry("/dav/JHS/", "<d:resourcetype><d:collection/></d:resourcetype>"), entry(`/dav/JHS/${name}`)]));
        expect(await f.client.listManagedBackups("JHS", source)).toEqual([name]);
    });
    it.each([
        `https://evil.example/dav/JHS/${name}`,
        `/different/JHS/${name}`,
        `/dav/JHS/nested/${name}`,
        `/dav/JHS/${name}?download=1`,
        `/dav/JHS/${name}#fragment`,
        `/dav/JHS/%2e%2e/${name}`,
        `/dav/JHS/%2F${name}`,
        `/dav/JHS/%5C${name}`,
        `/dav/JHS/${autoBackupFileName(other, Date.now())}`,
        "/dav/JHS/manual-backup.json",
    ])("rejects foreign, nested, escaped or unmanaged paths: %s", async href => {
        const f = fixture(xml([entry(href, undefined, undefined, name)]));
        expect(await f.client.listManagedBackups("JHS", source)).toEqual([]);
    });
    it.each([
        ["<d:resourcetype><d:collection/></d:resourcetype>", "200 OK"],
        ["<d:resourcetype/>", "403 Forbidden"],
        ["<d:getcontentlength>42</d:getcontentlength>", "200 OK"],
    ])("does not manage collections or failed/incomplete properties", async (properties, status) => {
        const f = fixture(xml([entry(`/dav/JHS/${name}`, properties, status)]));
        expect(await f.client.listManagedBackups("JHS", source)).toEqual([]);
    });
    it.each(["<html>login</html>", "<d:multistatus xmlns:d='DAV:'><broken>", "<multistatus/>"])("rejects malformed or unrelated responses", async body => {
        const f = fixture(body);
        await expect(f.client.listManagedBackups("JHS", source)).rejects.toThrow("格式无效");
    });
    it("cannot delete a manual or other-source file even when invoked directly", async () => {
        const f = fixture("");
        await expect(f.client.deleteManagedBackup("JHS", "manual.json", source)).rejects.toThrow("拒绝删除");
        await expect(f.client.deleteManagedBackup("JHS", autoBackupFileName(other, Date.now()), source)).rejects.toThrow("拒绝删除");
        expect(f.request).not.toHaveBeenCalled();
        await f.client.deleteManagedBackup("JHS", name, source);
        expect(f.request).toHaveBeenCalledWith(expect.objectContaining({ method: "DELETE", url: `https://dav.example/dav/JHS/${name}` }));
    });
    it("passes the lifecycle to HttpService while keeping unscoped calls compatible", async () => {
        const scope = new LifecycleScope("test"), request = vi.fn(async () => ({ data: "" }));
        const client = new WebDavService({ request }).createClient({ url: "https://dav.example/dav", username: "u", password: "p" }, { scope });
        await client.ensureFolder("JHS");
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "MKCOL", timeout: 10000 }), scope);
        scope.dispose();
    });
});
