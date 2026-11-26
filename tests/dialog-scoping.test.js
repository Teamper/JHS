import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { openFileListDialog } from "../src/features/settings/setting-backup.js";

describe("layered dialog DOM ownership", () => {

    it("scopes the WebDAV file-list table to its layer element", () => {
        const dom = new JSDOM('<body><div id="table-container" data-foreign="true"></div></body>'), $ = jqueryFactory(dom.window), targets = [];
        let options, root;
        const dialog = { open(value) { options = value; root = dom.window.document.createElement("section"); root.innerHTML = value.content; dom.window.document.body.append(root); value.success(root); return 1; }, close() {} };
        const Table = class { constructor(target) { targets.push(target); } destroy() {} };
        openFileListDialog([], {}, "WebDAV", "JHS", () => {}, dialog, {
            jquery: $, document: dom.window.document, window: dom.window,
            utilities: { isMobileMode: () => false, getResponsiveArea: () => [] },
            notifications: {}, logger: {}, domUi: { tableConstructor: Table },
        });
        expect(targets).toEqual([root.querySelector(".jhs-table-dialog__content")]);
        expect(targets[0]).not.toBe(dom.window.document.querySelector('[data-foreign="true"]'));
        options.end(); dom.window.close();
    });
});
