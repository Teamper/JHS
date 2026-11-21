import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { openFileListDialog } from "../src/plugins/backup/setting-backup.js";

const blacklist = readTestFile(join(process.cwd(), "src/features/library/blacklist-workspace-controller.js"), "utf8");
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
        const dom = new JSDOM('<body><div id="table-container" data-foreign="true"></div></body>'), $ = jqueryFactory(dom.window), targets = [];
        let options, root;
        const dialog = { open(value) { options = value; root = dom.window.document.createElement("section"); root.innerHTML = value.content; dom.window.document.body.append(root); value.success(root); return 1; }, close() {} };
        const Table = class { constructor(target) { targets.push(target); } destroy() {} };
        openFileListDialog([], {}, "WebDAV", "JHS", () => {}, dialog, {
            jquery: $, document: dom.window.document, window: dom.window,
            utilities: { isMobileMode: () => false, getResponsiveArea: () => [] },
            legacyStorage: {}, notifications: {}, logger: {}, domUi: { tableConstructor: Table },
        });
        expect(targets).toEqual([root.querySelector(".jhs-table-dialog__content")]);
        expect(targets[0]).not.toBe(dom.window.document.querySelector('[data-foreign="true"]'));
        options.end(); dom.window.close();
    });

    it("scopes History dialog CSS under the dialog root class", () => {
        expect(historyStyles).toContain(".jhs-history-dialog #filterBox");
        expect(historyStyles).toContain(".jhs-history-dialog #allSelectBox");
        expect(historyStyles).toContain(".jhs-history-dialog #table-container");
        expect(historyStyles).toMatch(/@media\(max-width:767px\),\(pointer:coarse\)[^\n]*\.jhs-history-dialog #table-container\s*\{\s*flex:1 0 360px;\s*min-height:360px;/);
        expect(history).not.toContain("async initCss()");
        expect(history).toContain('class="jhs-history-layout jhs-history-dialog"');
        expect(history).not.toContain("async handle()");
        expect(history).not.toContain("createBusButton()");
    });
});
