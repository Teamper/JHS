import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const blacklist = readTestFile(join(process.cwd(), "src/features/library/blacklist-workspace-controller.js"), "utf8");
const settingBackup = readTestFile(join(process.cwd(), "src/plugins/backup/setting-backup.js"), "utf8");
const history = readTestFile(join(process.cwd(), "src/features/library/history-dialog-controller.js"), "utf8");
const historyStyles = readTestFile(join(process.cwd(), "src/features/library/history-styles.js"), "utf8");

function methodBody(source, start, end) {
    return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

describe("layered dialog DOM ownership", () => {
    it("scopes blacklist dialog queries to the layer root", () => {
        expect(blacklist).toContain("this.blacklistRoot = dialogRoot;");
        expect(blacklist).toContain("this.blacklistRoot = null");
        expect(blacklist).toContain('root.find("#dataType")');
        const getData = methodBody(blacklist, "async getTableData", "async loadTableData");
        expect(getData).toContain('root.find("#searchValue")');
        expect(getData).toContain('root.find("#dataType")');
        const renderStatus = methodBody(blacklist, "renderTaskStatus()", "async reloadTable");
        expect(renderStatus).toContain('this.blacklistRoot?.find("#blacklist-task-status")');
        // the table is created on a scoped element, never the global "#table-container" selector
        expect(blacklist).not.toContain('Tabulator, "#table-container"');
    });

    it("scopes the WebDAV file-list table to its layer element", () => {
        const open = methodBody(settingBackup, "function openFileListDialog(e, t, n, folderName, showDiffPreviewFn, dialog, dependencies) {", "async function exportSettingData");
        expect(open).toContain('$(a).find(".jhs-table-dialog__content")');
        expect(open).not.toContain('Tabulator, "#table-container"');
    });

    it("scopes History dialog CSS under the dialog root class", () => {
        expect(historyStyles).toContain(".jhs-history-dialog #filterBox");
        expect(historyStyles).toContain(".jhs-history-dialog #allSelectBox");
        expect(historyStyles).toContain(".jhs-history-dialog #table-container");
        expect(history).not.toContain("async initCss()");
        expect(history).toContain('class="jhs-history-layout jhs-history-dialog"');
        expect(history).not.toContain("async handle()");
        expect(history).not.toContain("createBusButton()");
    });
});
