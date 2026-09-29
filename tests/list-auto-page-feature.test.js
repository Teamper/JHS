// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { migrateDisabledPlugins } from "../src/app/feature-runtime.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import listFeature from "../src/features/list/manifest.js";
import { compatibilityContributionCatalog } from "../src/features/compatibility/contribution-catalog.js";

function setup(styleRegistration = vi.fn(() => vi.fn())) {
    document.body.innerHTML = '<div class="movie-list"><div class="item"></div></div>';
    window.isListPage = true;
    const scope = new LifecycleScope("test-list-feature");
    const errors = [];
    const hostAdapter = {
        site: "javdb", document, location: window.location,
        getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }),
        locateListRoot: () => document.querySelector(".movie-list"),
    };
    const settings = { snapshot: () => ({ autoPage: "yes", sortMethod: "default" }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const eventBus = { on: vi.fn(() => vi.fn()) };
    const deps = {
        [PORT.host]: hostAdapter,
        [PORT.style]: { register: styleRegistration },
        [SERVICE.settings]: settings,
        [SERVICE.http]: { request: vi.fn() },
        [SERVICE.events]: eventBus,
        [SERVICE.domUi]: { jquery: (value) => globalThis.$(value) },
    };
    const runtime = {
        enabledContributions: ["list.auto-page"], scope,
        diagnostics: { recordError: (error) => errors.push(error) },
        resolveCompatibilityBean: vi.fn(() => undefined),
        route: "list",
    };
    return { scope, errors, deps, runtime, settings, eventBus, styleRegistration };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("List Feature native auto-page ownership", () => {
    it("preserves the legacy disable ID while moving execution out of PluginManager", async () => {
        const contribution = compatibilityContributionCatalog.find((item) => item.id === "list.auto-page");
        expect(contribution).toMatchObject({ featureId: "list", legacyPluginId: "AutoPagePlugin", executionOwner: "feature", plugin: null });
        expect(migrateDisabledPlugins(["AutoPagePlugin"])).toEqual(["list.auto-page"]);
        const fixture = setup();
        const result = await listFeature.activate(fixture.deps, fixture.runtime);
        expect(result.activeContributions).toContain("list.auto-page");
        expect(fixture.runtime.resolveCompatibilityBean).toHaveBeenCalledWith("ListPagePlugin");
        expect(fixture.styleRegistration).toHaveBeenCalledWith("jhs-auto-page-feature", expect.stringContaining(".jhs-scroll"));
        expect(fixture.eventBus.on).toHaveBeenCalledWith("list-items-added", expect.any(Function));
        result.dispose();
        fixture.scope.dispose();
        expect(fixture.styleRegistration.mock.results[0].value).toHaveBeenCalledOnce();
    });

    it("contains style startup failures and leaves auto-page inactive", async () => {
        const error = new Error("style registry unavailable");
        const fixture = setup(() => { throw error; });
        const result = await listFeature.activate(fixture.deps, fixture.runtime);
        expect(result.activeContributions).not.toContain("list.auto-page");
        expect(fixture.errors).toContainEqual(expect.objectContaining({ contributionId: "list.auto-page", message: error.message }));
        result.dispose();
        fixture.scope.dispose();
    });
});
