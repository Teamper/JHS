import { describe, expect, it, vi } from "vitest";
import { ScreenshotService } from "../src/services/screenshot-service.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

describe("ScreenshotService", () => {
    it("normalizes screenshot assets at the service boundary", () => {
        const service = new ScreenshotService(null, null);
        expect(service.normalizeAssetUrl("http://img.javstore.net/legacy.jpg")).toBe("https://img.javstore.net/legacy.jpg");
        expect(service.normalizeAssetUrl("javascript:alert(1)")).toBeNull();
    });

    it("keeps provider priority before integration fallback", async () => {
        const provider = { id: "preferred", resolve: vi.fn(async () => ["provider-image"]) };
        const providers = { getAvailable: vi.fn(async () => [provider]), updateHealth: vi.fn() };
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" })).resolves.toEqual(["provider-image"]);
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("uses normalized Integration images when providers have no result", async () => {
        const providers = { getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/a.jpg", providerId: "javstore" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { scope: "scope" })).resolves.toEqual([
            { url: "https://javstore.net/a.jpg", providerId: "javstore" },
        ]);
        expect(getImages).toHaveBeenCalledWith({ carNum: "ABC-123" }, { scope: "scope" });
    });

    it("gets provider confirmation URLs through the Integration boundary", () => {
        const providers = { getAvailable: vi.fn(), updateHealth: vi.fn() };
        const getSearchUrl = vi.fn(() => "https://javstore.net/search?q=ABC-123");
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getSearchUrl })) };
        expect(new ScreenshotService(providers, integrations).getSearchUrl({ carNum: "ABC-123" })).toBe("https://javstore.net/search?q=ABC-123");
        expect(getSearchUrl).toHaveBeenCalledWith({ carNum: "ABC-123" });
    });

    it("allows the list manual button to resolve while detail auto-load is disabled", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/manual.jpg" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "no" };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toBeNull();
        await expect(service.resolve({ carNum: "ABC-123" }, { settings, allowWhenDisabled: true })).resolves.toEqual([{ url: "https://javstore.net/manual.jpg" }]);
    });
});

describe("ScreenshotService explicit provider resolution", () => {
    const threeIntegrations = () => ({ list: vi.fn(() => [ { id: "javstore" }, { id: "javbus" }, { id: "fc2content" } ]), getAdapter: vi.fn() });

    it("resolves an explicit javstore hit and does not consult javbus or fc2content", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://javstore.net/long.jpg", providerId: "javstore" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toEqual([
            { url: "https://javstore.net/long.jpg", providerId: "javstore" },
        ]);
        expect(integrations.getAdapter).toHaveBeenCalledTimes(1);
        expect(integrations.getAdapter).toHaveBeenCalledWith("javstore");
        expect(getImages).toHaveBeenCalledWith({ carNum: "ABC-123" }, { providerId: "javstore" });
    });

    it("returns null on an explicit javstore miss without falling back to javbus or fc2content", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => []);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toBeNull();
        expect(integrations.getAdapter).toHaveBeenCalledTimes(1);
        expect(integrations.getAdapter).toHaveBeenCalledWith("javstore");
    });

    it("does not call an explicit disabled provider or fall back to another source", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://javstore.net/a.jpg" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { get: vi.fn(() => ({ id: "javstore", enabled: false, capabilities: [ "screenshot" ] })), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("never lets JavBus cover or FC2 gallery enter the long-thumbnail path", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://example.com/cover.jpg" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "FC2-123" }, { providerId: "fc2content" })).resolves.toBeNull();
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javbus" })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
        expect(new ScreenshotService(providers, integrations).getSearchUrl({ carNum: "ABC-123" })).toBeNull();
    });

    it("returns null for an unknown explicit providerId without calling any adapter", async () => {
        const integrations = threeIntegrations();
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "missing" })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("defaults to javstore only and never lets javbus or fc2content enter the long-thumbnail path", async () => {
        const integrations = threeIntegrations();
        const getImages = vi.fn(async () => [ { url: "https://javstore.net/long.jpg", providerId: "javstore" } ]);
        integrations.getAdapter.mockReturnValue({ getImages });
        const providers = { getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" })).resolves.toEqual([
            { url: "https://javstore.net/long.jpg", providerId: "javstore" },
        ]);
        expect(integrations.getAdapter).toHaveBeenCalledTimes(1);
        expect(integrations.getAdapter).toHaveBeenCalledWith("javstore");
    });

    it("honors an explicit runtime screenshot provider before the integration", async () => {
        const provider = { id: "javstore", capabilities: [ "screenshot" ], resolve: vi.fn(async () => [ "provider-long" ]) };
        const providers = { get: vi.fn(() => provider), updateHealth: vi.fn() };
        const integrations = threeIntegrations();
        await expect(new ScreenshotService(providers, integrations).resolve({ carNum: "ABC-123" }, { providerId: "javstore" })).resolves.toEqual([ "provider-long" ]);
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });
});

describe("ScreenshotService provider whitelist", () => {
    it("returns null immediately when all providers are disabled", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/a.jpg" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
        expect(providers.getAvailable).not.toHaveBeenCalled();
    });

    it("does not call a disabled javstore through the default fallback", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/a.jpg" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toBeNull();
        expect(integrations.getAdapter).not.toHaveBeenCalled();
    });

    it("rejects an explicit providerId that is not in the whitelist", async () => {
        const provider = { id: "projectjav", capabilities: ["screenshot"], resolve: vi.fn(async () => ["x"]) };
        const providers = { get: vi.fn(() => provider), getAvailable: vi.fn(async () => []), updateHealth: vi.fn() };
        const integrations = { list: vi.fn(() => []), getAdapter: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: true }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { providerId: "projectjav", settings })).resolves.toBeNull();
        expect(provider.resolve).not.toHaveBeenCalled();
    });

    it("keeps the whitelisted javstore working in default and explicit modes", async () => {
        const getImages = vi.fn(async () => [{ url: "https://javstore.net/long.jpg", providerId: "javstore" }]);
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getImages })) };
        const providers = { getAvailable: vi.fn(async () => []), get: vi.fn(() => null), updateHealth: vi.fn() };
        const service = new ScreenshotService(providers, integrations);
        const settings = { enableLoadScreenShot: "yes", screenshotProviders: JSON.stringify([{ id: "javstore", enabled: true, priority: 5 }]) };
        await expect(service.resolve({ carNum: "ABC-123" }, { settings })).resolves.toEqual([{ url: "https://javstore.net/long.jpg", providerId: "javstore" }]);
        await expect(service.resolve({ carNum: "ABC-123" }, { providerId: "javstore", settings })).resolves.toEqual([{ url: "https://javstore.net/long.jpg", providerId: "javstore" }]);
    });

    it("getSearchUrl returns null when javstore is disabled", () => {
        const integrations = { list: vi.fn(() => [{ id: "javstore" }]), getAdapter: vi.fn(() => ({ getSearchUrl: () => "https://javstore.net/search?q=ABC-123" })) };
        const service = new ScreenshotService({ getAvailable: vi.fn(), updateHealth: vi.fn() }, integrations);
        expect(service.getSearchUrl({ carNum: "ABC-123" }, { screenshotProviders: JSON.stringify([{ id: "javstore", enabled: false }]) })).toBeNull();
    });
});


describe("multiple enabled screenshot integrations", () => {
    function setup() {
        const calls = [];
        const adapters = {
            javstore: { getImages: vi.fn(async () => { calls.push("javstore"); throw new Error("source offline"); }) },
            projectjav: { getImages: vi.fn(async () => { calls.push("projectjav"); return []; }) },
            javfree: { getImages: vi.fn(async () => { calls.push("javfree"); return [{ url: "https://cf.javfree.me/HLIC/ABC-123-1080p.jpg", providerId: "javfree" }]; }) },
        };
        const integrations = { list: () => Object.keys(adapters).map(id => ({ id })), getAdapter: id => adapters[id] };
        const diagnostics = { updateProvider: vi.fn() };
        const service = new ScreenshotService({ getAvailable: async () => [] }, integrations, diagnostics);
        const settings = { screenshotProviders: [{ id: "javstore", enabled: true, priority: 10 }, { id: "projectjav", enabled: true, priority: 20 }, { id: "javfree", enabled: true, priority: 30 }] };
        return { service, settings, calls, adapters, diagnostics };
    }
    it("falls through errors and empty sources in configured priority order", async () => {
        const h = setup();
        const result = await h.service.resolve({ carNum: "ABC-123" }, { settings: h.settings });
        expect(result[0].providerId).toBe("javfree");
        expect(h.calls).toEqual(["javstore", "projectjav", "javfree"]);
        expect(h.diagnostics.updateProvider).toHaveBeenCalledWith("javstore", expect.objectContaining({ ok: false }));
        expect(h.diagnostics.updateProvider).toHaveBeenCalledWith("javfree", expect.objectContaining({ ok: true, count: 1 }));
    });
    it("uses user priority and forwards refresh only to the explicitly selected source", async () => {
        const h = setup();
        h.settings.screenshotProviders[2].priority = 1;
        await h.service.resolve({ carNum: "ABC-123" }, { settings: h.settings });
        expect(h.calls).toEqual(["javfree"]);
        await h.service.resolve({ carNum: "ABC-123" }, { providerId: "projectjav", refreshCache: true, settings: h.settings });
        expect(h.calls).toEqual(["javfree", "projectjav"]);
        expect(h.adapters.projectjav.getImages).toHaveBeenLastCalledWith({ carNum: "ABC-123" }, expect.objectContaining({ refreshCache: true, providerId: "projectjav" }));
    });
    it("keeps new sources off by default", async () => {
        const h = setup();
        await expect(h.service.resolve({ carNum: "ABC-123" }, { settings: {} })).rejects.toThrow("source offline");
        expect(h.calls).toEqual(["javstore"]);
    });
});

it("retains bounded JavStore failure stages in provider diagnostics", async () => {
    const details = { stage: "search", reason: "identity", candidateCount: 2, identityRejected: 2 };
    const error = Object.assign(new Error("JavStore 缩略图候选核验失败"), { code: "INVALID_RESPONSE", source: "javstore", details });
    const diagnostics = { updateProvider: vi.fn() };
    const integrations = { list: () => [{ id: "javstore" }], getAdapter: () => ({ getImages: async () => { throw error; } }) };
    const service = new ScreenshotService({ get: () => null }, integrations, diagnostics);
    await expect(service.resolve({ carNum: "MSFH-021" }, { providerId: "javstore" })).rejects.toBe(error);
    expect(diagnostics.updateProvider).toHaveBeenCalledWith("javstore", expect.objectContaining({ ok: false, details }));
});
describe("first-open screenshot selection", () => {
    const image = (name, providerId = "javstore", match = "confirmed", rank = 0) => ({
        url: `https://${providerId}.net/${name}.jpg`, providerId, match, rank,
    });
    const serviceFor = (adapters) => new ScreenshotService({ getAvailable: async () => [] }, {
        list: () => Object.keys(adapters).map(id => ({ id })),
        getAdapter: id => adapters[id],
    });
    const movie = { carNum: "ABC-170", title: "探索用プレビュー" };
    const settings = { screenshotProviders: [{ id: "javfree", enabled: true }] };

    it("tries later images on the same source, then falls back to a confirmed backup before displaying a candidate", async () => {
        const broken = image("broken"), later = image("later"), candidate = image("weak", "javstore", "candidate", 2);
        const backup = image("backup", "javfree");
        const getImageBatches = vi.fn(async function* () { yield [candidate, broken]; yield [later]; });
        const other = vi.fn(async () => [backup]);
        const service = serviceFor({ javstore: { getImages: vi.fn(), getImageBatches }, javfree: { getImages: other } });
        const loadImage = vi.fn(async url => url === backup.url ? { src: url } : null);
        await expect(service.resolvePreview(movie, { settings, loadImage })).resolves.toMatchObject({
            url: backup.url, providerId: "javfree", match: "confirmed",
        });
        expect(loadImage.mock.calls.map(([url]) => url)).toEqual([broken.url, later.url, backup.url]);
        expect(getImageBatches).toHaveBeenCalledOnce();
    });

    it("tries candidates by rank after one title query and keeps manual mode on its selected source", async () => {
        const first = image("first", "javstore", "candidate", 2), best = image("best", "javstore", "candidate", 3);
        const getImageBatches = vi.fn(async function* (_movie, { preview }) {
            if (preview.titleQuery) yield [best];
            else yield [first];
        });
        const backup = vi.fn();
        const service = serviceFor({ javstore: { getImages: vi.fn(), getImageBatches }, javfree: { getImages: backup } });
        const loadImage = vi.fn(async url => url === best.url ? null : { src: url });
        await expect(service.resolvePreview(movie, { providerId: "javstore", settings, loadImage })).resolves.toEqual({
            url: first.url, providerId: "javstore", match: "candidate", image: { src: first.url },
        });
        expect(getImageBatches.mock.calls.map(([, { preview }]) => Boolean(preview.titleQuery))).toEqual([false, true]);
        expect(loadImage.mock.calls).toEqual([[best.url], [first.url]]);
        expect(backup).not.toHaveBeenCalled();
    });

    it("falls through a source timeout and ignores a loaded image after the preview closes", async () => {
        const scope = new LifecycleScope("closed-preview");
        const backup = image("backup", "javfree");
        const failed = vi.fn(async () => { throw Object.assign(new Error("timeout"), { code: "TIMEOUT" }); });
        const service = serviceFor({ javstore: { getImages: failed }, javfree: { getImages: async () => [backup] } });
        let finish;
        const loadImage = vi.fn(() => new Promise(resolve => { finish = resolve; }));
        const request = service.resolvePreview(movie, { settings, scope, loadImage });
        await vi.waitFor(() => expect(loadImage).toHaveBeenCalledWith(backup.url));
        const closed = expect(request).rejects.toMatchObject({ name: "AbortError" });
        scope.dispose();
        finish({ src: backup.url });
        await closed;
        expect(failed).toHaveBeenCalledOnce();
    });
});
