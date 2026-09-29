// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import externalBridge from "../src/features/external-bridge/manifest.js";
import fc2Catalog from "../src/features/external-bridge/fc2-catalog-manifest.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import jqueryFactory from "jquery";

describe("external bridge Feature ownership", () => {
    it("provides one scoped magnet capability to existing consumers and keeps the old bean alias", async () => {
        const feature = externalBridge;
        const scope = new LifecycleScope("feature:external-bridge");
        const releaseStyle = vi.fn(), releaseBean = vi.fn(), consumers = new Map(["DetailPageButtonPlugin", "Fc2Plugin", "MobileBottomBarPlugin"].map((name) => [name, {
            attachFeatureMagnetHubAdapter: vi.fn(), detachFeatureMagnetHubAdapter: vi.fn(),
        }]));
        const style = { register: vi.fn(() => releaseStyle) };
        const diagnostics = { recordError: vi.fn() };
        let compatibilityBean;
        const result = await feature.activate({
            [PORT.style]: style, [SERVICE.storage]: {}, [SERVICE.http]: {}, [SERVICE.magnet]: {},
            [SERVICE.resourceSettings]: {}, [SERVICE.clipboard]: {}, [SERVICE.domUi]: { jquery: vi.fn() }, [SERVICE.diagnostics]: diagnostics,
        }, {
            enabledContributions: ["detail.external-magnets"], scope, diagnostics,
            site: "javdb", resolveCompatibilityBean: (name) => consumers.get(name),
            isContributionEnabled: (featureId, contributionId) => featureId === "fc2-workspace" && contributionId === "detail.fc2-owned",
            executeCommand: async (command) => { expect(command).toBe("detail.fc2.workspace"); return consumers.get("Fc2Plugin"); },
            registerCompatibilityBean: vi.fn((name, bean) => {
                expect(name).toBe("MagnetHubPlugin");
                compatibilityBean = bean;
                return releaseBean;
            }),
        });

        expect(result.activeContributions).toEqual(["detail.external-magnets"]);
        expect(style.register).toHaveBeenCalledWith("jhs-detail-external-magnets-feature", expect.stringContaining(".magnet-container"));
        expect(compatibilityBean).toMatchObject({ managedByFeature: true, runtimeStatus: "managed-feature" });
        for (const consumer of consumers.values()) expect(consumer.attachFeatureMagnetHubAdapter).toHaveBeenCalledWith(compatibilityBean);
        expect(diagnostics.recordError).not.toHaveBeenCalled();
        scope.dispose();
        expect(releaseStyle).toHaveBeenCalledOnce();
        expect(releaseBean).toHaveBeenCalledOnce();
        for (const consumer of consumers.values()) expect(consumer.detachFeatureMagnetHubAdapter).toHaveBeenCalledWith(compatibilityBean);
    });

    it("does not resolve or mount the shared magnet hub when its legacy contribution is disabled", async () => {
        const feature = externalBridge;
        const scope = new LifecycleScope("feature:external-bridge");
        const result = await feature.activate({ [PORT.style]: { register: vi.fn() } }, {
            enabledContributions: [], scope, diagnostics: { recordError: vi.fn() },
        });
        expect(result.activeContributions).toEqual([]);
        scope.dispose();
    });

    it("starts and releases 123Pan credential synchronization under the bridge Feature", async () => {
        const feature = externalBridge;
        const scope = new LifecycleScope("feature:external-bridge");
        const stop = vi.fn(), credential = { startTokenSync: vi.fn(scope => scope.addCleanup(stop)) };
        const diagnostics = { recordError: vi.fn() };
        const result = await feature.activate({ [PORT.style]: { register: vi.fn() }, [SERVICE.pan123Credential]: credential }, {
            enabledContributions: ["external-bridge.123pan"], scope, diagnostics,
        });

        expect(result.activeContributions).toEqual(["external-bridge.123pan"]);
        expect(credential.startTokenSync).toHaveBeenCalledWith(scope);
        scope.dispose();
        expect(stop).toHaveBeenCalledOnce();
        expect(diagnostics.recordError).not.toHaveBeenCalled();
    });

    it("declares the host and state boundaries required by page-scoped offline actions", () => {
        expect(externalBridge.optionalRequires).toContain(PORT.host);
        expect(externalBridge.requires).toContain(SERVICE.state);
        expect(externalBridge.requires).not.toContain(SERVICE.movie);
    });

    it("owns 123AV catalog and FC2 detail capability while preserving the compatibility alias", async () => {
        document.body.innerHTML = '<nav id="navbar-menu-hero"><a href="/tags/fc2">FC2</a></nav><section><div class="container"><h2 class="section-title">FC2</h2><div class="movie-list"><div class="item">host</div></div><nav class="pagination"></nav></div></section>';
        window.history.replaceState({}, "", "/tags/fc2?c10=1&jhs_source=123av");
        const scope = new LifecycleScope("feature:external-bridge");
        const releaseBean = vi.fn(), fc2 = { attachFeature123AvAdapter: vi.fn(), detachFeature123AvAdapter: vi.fn() };
        const listPage = { processAddedItems: vi.fn(async () => {}) };
        const host = {
            getListContainer: () => document.querySelector(".container"),
            createOwnedListRoot(classes = []) { const root = document.createElement("div"); root.classList.add("movie-list", "h", "cols-4", "vcols-8", ...classes); return root; },
            mountExternalFc2Catalog(root) { const container = document.querySelector(".container"); container.querySelector(":scope > .movie-list")?.remove(); container.querySelector(":scope > nav.pagination")?.remove(); container.append(root); },
        };
        const diagnostics = { recordError: vi.fn() };
        const registerCompatibilityBean = vi.fn((name, controller) => {
            expect(name).toBe("Fc2By123AvPlugin");
            expect(controller).toMatchObject({ managedByFeature: true, runtimeStatus: "managed-feature" });
            return releaseBean;
        });
        const result = await fc2Catalog.activate({
            [PORT.host]: host, [PORT.style]: { register: vi.fn() }, [SERVICE.movie]: { catalog: vi.fn(async () => ({ items: [], maxPage: 1 })) },
            [SERVICE.domUi]: { jquery: jqueryFactory(window), loading: () => ({ close() {} }), smoothScrollToTop: async () => {} },
            [SERVICE.notifications]: { error: vi.fn() }, [SERVICE.diagnostics]: diagnostics,
        }, {
            enabledContributions: ["detail.fc2-lookup"], scope, diagnostics, site: "javdb", route: "list",
            isContributionEnabled: (featureId, contributionId) => featureId === "fc2-workspace" && contributionId === "detail.fc2-owned",
            executeCommand: async (command) => { expect(command).toBe("detail.fc2.workspace"); return fc2; },
            resolveCompatibilityBean: (name) => name === "Fc2Plugin" ? fc2 : name === "ListPagePlugin" ? listPage : null,
            registerCompatibilityBean,
        });

        expect(result.activeContributions).toEqual(["detail.fc2-lookup"]);
        expect(result.commands["fc2-catalog.ensure"]()).toMatchObject({ managedByFeature: true });
        expect(document.querySelector("#jhs-123av-nav").getAttribute("href")).toBe("/tags/fc2?c10=1&jhs_source=123av");
        expect(document.querySelector(".jhs-123av-list")).not.toBeNull();
        expect(fc2.attachFeature123AvAdapter).toHaveBeenCalledWith(expect.objectContaining({ managedByFeature: true }));
        expect(diagnostics.recordError).not.toHaveBeenCalled();
        scope.dispose();
        expect(fc2.detachFeature123AvAdapter).toHaveBeenCalledOnce();
        expect(releaseBean).toHaveBeenCalledOnce();
        expect(document.querySelector("#jhs-123av-nav")).toBeNull();
        expect(document.querySelector(".jhs-123av-list")).toBeNull();
    });

    it("keeps the FC2 ensure command safe when its legacy contribution is disabled", async () => {
        const result = await fc2Catalog.activate({}, { enabledContributions: [], diagnostics: { recordError: vi.fn() } });
        expect(result.activeContributions).toEqual([]);
        expect(result.commands["fc2-catalog.ensure"]()).toBeNull();
    });

    it("starts the native offline controller and releases its compatibility facade and styles", async () => {
        const feature = externalBridge;
        const scope = new LifecycleScope("feature:external-bridge");
        const releaseStyle = vi.fn(), releaseBean = vi.fn();
        const style = { register: vi.fn(() => releaseStyle) }, diagnostics = { recordError: vi.fn() };
        const settings = { snapshot: () => ({ enable123Offline: true, enable115Offline: false }) };
        let compatibilityBean;
        const result = await feature.activate({
            [PORT.style]: style, [PORT.host]: { site: "javdb", locateListItems: () => [] },
            [SERVICE.offline]: { getIntegrationHomeUrl: () => "https://pan.example/", submitWithIntegration: vi.fn() },
            [SERVICE.dialog]: { open: vi.fn(), close: vi.fn() }, [SERVICE.state]: { appendOfflineHistory: vi.fn(), patch: vi.fn() },
            [SERVICE.settings]: settings, [SERVICE.events]: { on: vi.fn(() => () => {}) },
            [SERVICE.pan123Credential]: { getStoredToken: async () => "token" },
            [SERVICE.domUi]: { jquery: jqueryFactory, confirm: vi.fn(), closePage: vi.fn(), getDialogArea: () => [] },
            [SERVICE.notifications]: { ok: vi.fn(), error: vi.fn() }, [SERVICE.diagnostics]: diagnostics,
        }, {
            enabledContributions: ["external-bridge.offline"], scope, diagnostics,
            site: "javdb", route: "list",
            registerCompatibilityBean: vi.fn((name, bean) => { expect(name).toBe("UnifiedOfflinePlugin"); compatibilityBean = bean; return releaseBean; }),
        });

        expect(result.activeContributions, JSON.stringify(diagnostics.recordError.mock.calls)).toEqual(["external-bridge.offline"]);
        expect(compatibilityBean).toMatchObject({ managedByFeature: true, getName: expect.any(Function) });
        expect(style.register).toHaveBeenCalledWith("jhs-external-bridge-offline-feature", expect.stringContaining(".jhs-offline-btn"));
        expect(diagnostics.recordError).not.toHaveBeenCalled();
        scope.dispose();
        expect(releaseStyle).toHaveBeenCalledOnce();
        expect(releaseBean).toHaveBeenCalledOnce();
    });
});
