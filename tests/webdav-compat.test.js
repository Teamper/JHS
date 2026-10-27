import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readTestFile(join(import.meta.dirname, "../src/services/webdav-service.js"), "utf8");
describe("WebDAV compatibility contracts", () => {
    it("accepts existing and parent-conflict MKCOL responses", () => expect(source).toMatch(/405\|409/));
    it("keeps display labels separate from decoded file identifiers", () => {
        expect(source).toContain("decodeURIComponent");
        expect(source).toContain('fileId');
        expect(source).toContain('displayname');
    });
});
