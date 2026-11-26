import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { BlacklistWorkspaceController } from "../src/features/library/blacklist-workspace-controller.js";
import { renderTaskStatus } from "../src/core/task-status-view.js";

describe("blacklist task status parity", () => {
    it.each([
        [{ ready: true, state: "idle", nextAt: 0 }, { enableCheckBlacklist: "no" }],
        [{ ready: false, state: "idle", nextAt: 0 }, {}],
        [{ ready: true, state: "running", nextAt: 0 }, {}],
        [{ ready: true, state: "pending", isPending: true, nextAt: 0 }, {}],
        [{ ready: true, state: "due", nextAt: 1 }, {}],
        [{ ready: true, state: "idle", nextAt: 0 }, {}],
    ])("uses the same committed schedule interpretation as other surfaces: %j", (snapshot, settings) => {
        const dom = new JSDOM('<div id="workspace"><div id="blacklist-task-status"></div></div>'), $ = jquery(dom.window);
        const controller = new BlacklistWorkspaceController({ jquery: $, settings: { snapshot: () => settings }, task: { current: () => ({ getTaskStatusSnapshot: () => snapshot }) } });
        controller.blacklistRoot = $("#workspace"); controller.renderTaskStatus();
        expect($("#blacklist-task-status").text()).toBe(renderTaskStatus($, "blacklist", snapshot, settings).text());
        expect($("#blacklist-task-status .jhs-task-times")).toHaveLength(1); dom.window.close();
    });
});
