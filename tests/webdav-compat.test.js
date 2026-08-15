import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(import.meta.dirname, "../src/plugins/backup/webdav-client.js"), "utf8");
describe("WebDAV compatibility contracts", () => {
    it("accepts existing and parent-conflict MKCOL responses", () => expect(source).toMatch(/405\|409/));
    it("falls back from missing displayname to decoded href", () => {
        expect(source).toContain('getElementsByTagNameNS("DAV:", "href")');
        expect(source).toContain("decodeURIComponent");
        expect(source).toContain("displayNameNode?.textContent || fallbackName");
    });
});
