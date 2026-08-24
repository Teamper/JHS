// @vitest-environment jsdom
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { format115Size, normalize115Keyword, preview115Rename } from "../src/plugins/one-one-five/client.js";

describe("115 domain", () => {
    it("normalizes FC2 keywords and sizes", () => {
        expect(normalize115Keyword("FC2-123456")).toBe("123456");
        expect(format115Size(1024 ** 3)).toBe("1.00 GB");
    });
    it("preserves rename suffixes", () => {
        expect(preview115Rename("old-4K-U.mkv", "abc-1")).toBe("ABC-1-4K-U.mkv");
    });
    it("keeps disabled plugins request-free", () => {
        const source = readTestFile(join(import.meta.dirname, "../src/plugins/one-one-five/plugins.js"), "utf8");
        expect(source).toContain('getSetting("enable115Match", !1)');
        expect(source).toContain("await this.setupListMatching(hostAdapter)");
        expect(source).toContain("this.lifecycleScope.ownObserver(this.observer)");
        expect(source).toContain("hostAdapter.locateListRoot()");
        expect(source).not.toContain('$(".movie-list .item,.masonry .item")');
        expect(source).toContain('jhsEventBus.on("list-items-added"');
        expect(source).not.toContain("new MutationObserver");
        expect(source).not.toContain("gmHttp");
        expect(source).not.toContain("https://115.com");
        expect(source).toContain('getRuntimeService("offline").renameFile');
        expect(source).toContain('getRuntimeService("dialog").open');
        expect(source).not.toContain("layer.open");
    });
});
