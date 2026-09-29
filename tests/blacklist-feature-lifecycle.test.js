import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import library from "../src/features/library/manifest.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { BLACKLIST_STYLES } from "../src/features/library/blacklist-styles.js";
import { BlacklistScanController } from "../src/features/library/blacklist-scan-controller.js";
import { BlacklistWorkspaceController } from "../src/features/library/blacklist-workspace-controller.js";
import { BlacklistEntryController } from "../src/features/library/blacklist-entry-controller.js";

afterEach(() => vi.unstubAllGlobals());

function createRuntime(dom, { register = vi.fn(() => vi.fn()), taskPlugin = {} } = {}) {
    const jquery = jqueryFactory(dom.window);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("$", jquery);
    vi.stubGlobal("jQuery", jquery);
    const scope = new LifecycleScope("feature:library-blacklist");
    const dialog = { open: vi.fn(() => 9), close: vi.fn() };
    const ui = { jquery, getDialogArea: () => ["900px", "700px"], openPage: vi.fn(), confirm: vi.fn(), loading: vi.fn(), enhanceSelect: vi.fn(), setSelectValue: vi.fn() };
    const diagnostics = { recordError: vi.fn() };
    const runtime = {
        enabledContributions: ["library.blacklist"], diagnostics, scope, site: "javdb", route: "list",
        resolveCompatibilityBean: vi.fn((name) => name === "TaskPlugin" ? taskPlugin : null),
        executeCommand: vi.fn(async () => {}),
    };
    const dependencies = {
        [PORT.style]: { register },
        [SERVICE.storage]: { getLocal: vi.fn() },
        [SERVICE.state]: { getBlacklist: vi.fn(async () => []), getBlacklistCarList: vi.fn(async () => []), addBlacklistItem: vi.fn(), batchSaveBlacklistCarList: vi.fn(), removeBlacklistActor: vi.fn() },
        [SERVICE.http]: { request: vi.fn(async () => ({ data: "<div class='movie-list'></div>" })) },
        [SERVICE.settings]: { snapshot: () => ({}) }, [SERVICE.movie]: {},
        [SERVICE.domUi]: ui, [SERVICE.notifications]: { error: vi.fn(), info: vi.fn(), ok: vi.fn() },
        [SERVICE.events]: { on: vi.fn(() => vi.fn()), emit: vi.fn(async () => {}) },
        [SERVICE.dialog]: dialog, [SERVICE.clog]: { error: vi.fn(), warn: vi.fn() },
        [SERVICE.titleKeywords]: {}, [SERVICE.profile]: {},
    };
    return { scope, runtime, dependencies, dialog, diagnostics, ui, register, taskPlugin };
}

describe("library blacklist Feature lifecycle", () => {
    it("owns the blacklist entry, scanner and dialog inside Library scope and exposes commands", async () => {
        const dom = new JSDOM('<body><div class="movie-list"></div></body>', { url: "https://javdb.com/actors/a" });
        const taskPlugin = { singleTaskKey: "task-lock", attachFeatureBlacklistScanController: vi.fn(), detachFeatureBlacklistScanController: vi.fn() };
        const harness = createRuntime(dom, { taskPlugin });
        const activated = await library.activate(harness.dependencies, harness.runtime);
        expect(harness.register).toHaveBeenCalledExactlyOnceWith("jhs-library-blacklist-feature", BLACKLIST_STYLES);
        expect(activated.activeContributions).toEqual(["library.blacklist"]);
        expect(activated.commands["library.blacklist.open"]()).toBe(9);
        expect(taskPlugin.attachFeatureBlacklistScanController).toHaveBeenCalledOnce();
        const scan = taskPlugin.attachFeatureBlacklistScanController.mock.calls[0][0];
        expect(scan).toBeInstanceOf(BlacklistScanController);
        expect(harness.runtime.resolveCompatibilityBean).toHaveBeenCalledExactlyOnceWith("TaskPlugin");
        activated.dispose();
        harness.scope.dispose();
        expect(taskPlugin.detachFeatureBlacklistScanController).toHaveBeenCalledWith(scan);
        expect(scan.disposed).toBe(true);
        dom.window.close();
    });

    it("does not mount blacklist controllers when optional styles fail", async () => {
        const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" });
        const harness = createRuntime(dom, { register: vi.fn(() => { throw new Error("style host unavailable"); }) });
        const activated = await library.activate(harness.dependencies, harness.runtime);
        expect(activated.activeContributions).toEqual([]);
        expect(harness.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ source: "library-feature", contributionId: "library.blacklist" }));
        expect(activated.commands["library.blacklist.open"]()).toBeUndefined();
        activated.dispose();
        harness.scope.dispose();
        dom.window.close();
    });

    it("does not expose an old plugin instance for the Feature-owned controller", async () => {
        const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" });
        const harness = createRuntime(dom);
        const activated = await library.activate(harness.dependencies, harness.runtime);
        expect(harness.runtime.resolveCompatibilityBean).toHaveBeenCalledWith("TaskPlugin");
        expect(activated.commands["library.blacklist.parse"]).toBeTypeOf("function");
        expect(activated.commands["library.blacklist.add"]).toBeTypeOf("function");
        activated.dispose();
        harness.scope.dispose();
        dom.window.close();
    });
});
