import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { CommandRegistry } from "../src/app/command-registry.js";
import { DependencyContainer } from "../src/app/dependency-container.js";
import { FeatureRuntime } from "../src/app/feature-runtime.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import library from "../src/features/library/manifest.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { HistoryCompatibilityBean } from "../src/compat/history-compatibility-bean.js";

afterEach(() => vi.unstubAllGlobals());

describe("Library Feature history ownership", () => {
    function createRuntime({ disabled = ["BlacklistPlugin", "WantAndWatchedVideosPlugin", "FavoriteActressesPlugin", "FilterTitleKeywordPlugin"] } = {}) {
        const storage = { get: vi.fn(async () => []) }, state = { getActivityLog: vi.fn(), getOfflineHistory: vi.fn() }, profile = new EventTarget();
        const styleRelease = vi.fn(), styleRegistration = vi.fn(() => styleRelease), jquery = /** @type {any} */ (globalThis).$;
        const dialog = { open: vi.fn(() => 51), close: vi.fn() };
        const domUi = { jquery, confirm: vi.fn(), getDialogArea: vi.fn(() => ["800px", "700px"]), enhanceSelect: vi.fn(), setSelectValue: vi.fn(), loading: vi.fn(() => ({ close: vi.fn() })) };
        const runtime = new FeatureRuntime({
            container: new DependencyContainer()
                .register(PORT.host, {})
                .register(PORT.style, { register: styleRegistration })
                .register(SERVICE.http, {})
                .register(SERVICE.notifications, { ok: vi.fn(), info: vi.fn(), error: vi.fn() })
                .register(SERVICE.storage, storage)
                .register(SERVICE.state, state)
                .register(SERVICE.settings, { snapshot: () => ({}) })
                .register(SERVICE.movie, {})
                .register(SERVICE.titleKeywords, {})
                .register(SERVICE.domUi, domUi)
                .register(SERVICE.events, { emit: vi.fn() })
                .register(SERVICE.profile, profile)
                .register(SERVICE.dialog, dialog)
                .register(SERVICE.clipboard, { copyText: vi.fn() })
                .register(SERVICE.clog, { error: vi.fn(), warn: vi.fn() }),
            commands: new CommandRegistry(), diagnostics: new DiagnosticsService(), disabled, site: "javdb", route: "list",
        });
        runtime.setCompatibilityBeanResolver(() => undefined);
        runtime.setContributionCatalog([
            { id: "library.history", legacyPluginId: "HistoryPlugin", executionOwner: "feature", lifecycleOwner: "feature", sites: ["javdb"], routes: [], surfaces: [] },
            { id: "library.state-actions", legacyPluginId: "WantAndWatchedVideosPlugin", executionOwner: "feature", sites: ["javdb"], routes: ["list"], surfaces: ["list-page"] },
            { id: "library.favorite-actresses", legacyPluginId: "FavoriteActressesPlugin", executionOwner: "feature", sites: ["javdb"], routes: [], surfaces: [] },
        ]);
        runtime.register(library);
        return { runtime, storage, state, styleRegistration, styleRelease, dialog };
    }

    it("owns the History dialog, entry points, repository and cleanup", async () => {
        const dom = new JSDOM('<body><div class="navbar-end"></div><div class="navbar-search"></div></body>', { url: "https://javdb.com/" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("$", jqueryFactory(dom.window));
        const { runtime, styleRegistration, styleRelease, dialog } = createRuntime();
        const feature = await runtime.activate("library");

        expect(styleRegistration).toHaveBeenCalledWith("jhs-library-history-feature", expect.stringContaining(".jhs-history-layout"));
        expect(dom.window.document.querySelector("#historyBtn")).not.toBeNull();
        expect(dialog.open).not.toHaveBeenCalled();
        dom.window.document.querySelector("#historyBtn").click();
        await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
        expect(dialog.open.mock.calls[0][0]).toMatchObject({ title: "鉴定记录", shadeClose: true });

        feature.dispose();
        expect(dialog.close).toHaveBeenCalledOnce();
        expect(dom.window.document.querySelector("#historyBtn")).toBeNull();
        expect(styleRelease).toHaveBeenCalledOnce();
        dom.window.close();
    });

    it("drops a pending lazy History dialog load when the Feature is disposed", async () => {
        const dom = new JSDOM('<body><div class="navbar-end"></div><div class="navbar-search"></div></body>', { url: "https://javdb.com/" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("$", jqueryFactory(dom.window));
        const { runtime, dialog } = createRuntime();
        const feature = await runtime.activate("library");

        dom.window.document.querySelector("#historyBtn").click();
        feature.dispose();
        await Promise.resolve();
        await Promise.resolve();

        expect(dialog.open).not.toHaveBeenCalled();
        expect(dom.window.document.querySelector(".layui-layer")).toBeNull();
        dom.window.close();
    });

    it("keeps the legacy history repository available before the lazy dialog opens", async () => {
        const dom = new JSDOM('<body><div class="navbar-end"></div><div class="navbar-search"></div></body>', { url: "https://javdb.com/" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("$", jqueryFactory(dom.window));
        const { runtime } = createRuntime();
        const adapter = new HistoryCompatibilityBean(vi.fn(async () => undefined));
        runtime.setCompatibilityBeanResolver(() => adapter);
        const feature = await runtime.activate("library");
        const repository = adapter.historyRepository;

        expect(repository).toBeTruthy();
        expect(adapter.historySelectionModel).toBeTruthy();
        expect(adapter.controller).toBeNull();
        feature.dispose();
        expect(adapter.historyRepository).toBeNull();
        dom.window.close();
    });

    it("does not create the History UI when the stable Contribution ID is disabled", async () => {
        const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("$", jqueryFactory(dom.window));
        const { runtime, styleRegistration } = createRuntime({ disabled: ["HistoryPlugin", "BlacklistPlugin", "WantAndWatchedVideosPlugin", "FavoriteActressesPlugin", "FilterTitleKeywordPlugin"] });

        await runtime.activate("library");
        expect(styleRegistration).not.toHaveBeenCalledWith("jhs-library-history-feature", expect.any(String));
        expect(dom.window.document.querySelector("#historyBtn")).toBeNull();
        dom.window.close();
    });
});
