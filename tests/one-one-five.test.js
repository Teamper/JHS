// @vitest-environment jsdom
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { OneOneFiveMatchPlugin } from "../src/plugins/one-one-five/plugins.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { format115Size, normalize115Keyword, preview115Rename } from "../src/plugins/one-one-five/client.js";

describe("115 domain", () => {
    it("normalizes FC2 keywords and sizes", () => {
        expect(normalize115Keyword("FC2-123456")).toBe("123456");
        expect(format115Size(1024 ** 3)).toBe("1.00 GB");
    });
    it("preserves rename suffixes", () => {
        expect(preview115Rename("old-4K-U.mkv", "abc-1")).toBe("ABC-1-4K-U.mkv");
    });
    it("routes matching through declared services and host boundaries", () => {
        const source = readTestFile(join(import.meta.dirname, "../src/plugins/one-one-five/plugins.js"), "utf8");
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

it.each([false, "false", "no", 0, "0", null, "invalid"])("disabled 115 value %j owns no matching requests", async value => {
    vi.stubGlobal("$",jquery);
    const scope=new LifecycleScope("test-115"), settings=new EventTarget(), searchFiles=vi.fn();
    settings.snapshot=()=>({enable115Match:value});
    const plugin=new OneOneFiveMatchPlugin();
    plugin.runtimeServices={scope:async()=>scope,settings,offline:{searchFiles}};
    try { await plugin.handle(); expect(searchFiles).not.toHaveBeenCalled(); expect(plugin.lifecycleScope).toBeNull(); }
    finally { scope.dispose(); vi.unstubAllGlobals(); }
});
