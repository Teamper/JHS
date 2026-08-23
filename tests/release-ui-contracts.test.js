import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = file => readFileSync(join(process.cwd(), file), "utf8");

describe("v6.4.1 frozen UI contracts", () => {
    const newVideo = read("src/plugins/new-video/new-video.js");
    const mobile = read("src/plugins/status/mobile-bottom-bar.js");
    const logger = read("src/core/logger.js");
    const offline = read("src/plugins/offline/unified-offline.js");
    const setting = read("src/plugins/backup/setting.js");
    const settingTemplate = read("src/plugins/backup/setting-templates.js");
    const blacklist = read("src/plugins/blacklist/blacklist.js");

    it("uses native, tokenized Avatar candidate buttons without hover scaling", () => {
        const avatar = newVideo.slice(newVideo.indexOf("async searchAvatar()"));
        expect(avatar).toContain('<button type="button" class="jhs-btn gfriends-image-item-wrapper" aria-pressed="false">');
        expect(avatar).toContain('candidate.attr("aria-pressed", "true")');
        expect(avatar).toContain('content: r[0]');
        expect(avatar).not.toContain("translateY(-4px)");
        expect(avatar).not.toContain("scale(1.02)");
    });

    it("provides radio sort navigation and controlled command-bar menus", () => {
        expect(mobile).toContain('role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-mobile-sort-option"');
        expect(mobile).toContain('aria-controls="jhs-commandbar-more-menu"');
        expect(mobile).toContain('aria-controls="jhs-commandbar-batch-menu"');
        expect(mobile).toContain('if ("Escape" === event.key)');
        expect(mobile).toContain('if ("Tab" === event.key)');
        expect(mobile).toContain('toggle.attr("aria-expanded", "false").trigger("focus")');
        expect(mobile).not.toContain('cur === "default" ? "rateCount"');
    });

    it("opens mobile logs through the FAB and keeps the floating toggle hidden", () => {
        expect(mobile).toContain('item("logger", "运行日志")');
        expect(mobile).toContain("clog.openDialog?.()");
        expect(logger).toContain('window.matchMedia?.("(max-width: 768px)").matches');
        expect(logger).toContain("openDialog() {");
        expect(logger).toContain("content: host.outerHTML");
        expect(logger).toContain('find(".jhs-logger-dialog")[0]?.appendChild(this.window)');
        expect(logger).toContain("unsafeWindow.parent !== unsafeWindow");
    });

    it("keeps offline submission focusable while exposing busy semantics", () => {
        expect(offline).toContain('"aria-busy": "true", "aria-disabled": "true"');
        expect(offline).not.toContain('.prop("disabled", !0)');
    });

    it("places the three scheduler snapshots in the task settings panel", () => {
        expect(settingTemplate).toContain('id="setting-task-status-list"');
        expect(setting).toContain('getTaskStatusSnapshot(name)');
        expect(setting).toContain('jhsEventBus.on("task-status-changed"');
        expect(blacklist).toContain('getTaskStatusSnapshot("blacklist")');
    });

    it("clears the complete NewVideo workspace snapshot when the dialog closes", () => {
        const cleanupStart = newVideo.indexOf("\n    cleanupNewVideoWorkspace() {");
        const cleanup = newVideo.slice(cleanupStart, newVideo.indexOf("\n    bindClick()", cleanupStart));
        for (const field of [ "nvAllItemsMap.clear()", "nvFlatListCache = []", "nvActressesCache = []", "nvCarMapCache = new Map", "nvDecisionsCache = {}", "nvCurrentPageItems = []" ]) expect(cleanup).toContain(field);
    });
});
