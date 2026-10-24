// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import jquery from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { CoverButtonController } from "../src/features/list/cover-button-controller.js";
import { Fc2WorkspaceService } from "../src/features/detail/fc2-workspace-service.js";
import { ScreenshotService } from "../src/services/screenshot-service.js";
import { createJavStoreAdapter } from "../src/integrations/javstore/manifest.js";

const imageUrl = "https://img.javstore.net/FC2-PPV-1234567_s.jpg";
const scopes = [];
afterEach(() => {
    scopes.splice(0).forEach(scope => scope.dispose());
    jquery(document).off(".jhsCoverButton");
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
});

function createScreenshotChain() {
    const request = vi.fn(async options => ({
        data: options.url.includes("/search?")
            ? '<main><div class="grid"><a href="/FC2-PPV-1234567.html">FC2-PPV-1234567</a></div></main>'
            : `<main><img src="${imageUrl}" alt="FC2-PPV-1234567"></main>`,
        finalUrl: options.url,
    }));
    const adapter = createJavStoreAdapter({ request });
    const screenshot = new ScreenshotService({ get: () => null, getAvailable: async () => [] }, {
        list: () => [{ id: "javstore" }], getAdapter: () => adapter,
    });
    const scope = new LifecycleScope("fc2-screenshot-identity");
    scopes.push(scope);
    return { screenshot, request, scope, settings: { snapshot: () => ({ enableLoadScreenShot: "yes", screenshotMode: "auto" }) } };
}

it.each(["FC2-1234567", "FC2-PPV-1234567"])("resolves the list screenshot action through JavStore using complete identity %s", async carNum => {
    const { screenshot, request, scope, settings } = createScreenshotChain();
    document.body.innerHTML = '<div class="item"><button class="screenSvg">长缩略图</button></div>';
    const openImageViewer = vi.fn();
    const controller = new CoverButtonController({
        document, window, list: { findCarNumAndHref: () => ({ carNum }), getSelector: () => ({ itemSelector: ".item" }) }, settings, screenshot, scope,
        movie: { externalSiteOrigin: () => "https://example.test", providerOrigin: () => "https://example.test" },
        ui: { jquery, loading: () => ({ close() {} }), openImageViewer },
        notifications: { info: vi.fn(), error: vi.fn() }, diagnostics: { recordError: vi.fn() },
    });
    await controller.bindClick(scope);
    document.querySelector(".screenSvg").click();
    await vi.waitFor(() => expect(openImageViewer).toHaveBeenCalledWith(imageUrl, expect.objectContaining({ imageKind: "contact-sheet" })));
    expect(request.mock.calls.map(([options]) => options.url)).toEqual([
        `https://javstore.net/search?q=${encodeURIComponent(carNum)}`,
        "https://javstore.net/FC2-PPV-1234567.html",
    ]);
});

it.each(["FC2-1234567", "FC2-PPV-1234567"])("renders the FC2 workspace screenshot through JavStore using complete identity %s", async carNum => {
    const { screenshot, request, scope, settings } = createScreenshotChain();
    vi.stubGlobal("$", jquery);
    document.body.innerHTML = '<main><div data-jhs-role="screenshot"></div></main>';
    const service = new Fc2WorkspaceService({ runtimeServices: { screenshot, settings, scope: () => scope } });
    service.loadFc2Screenshot({ root: jquery("main"), carNum, isAlive: () => true });
    await vi.waitFor(() => expect(document.querySelector('[data-jhs-role="screenshot"] img')?.getAttribute("src")).toBe(imageUrl));
    expect(request.mock.calls.map(([options]) => options.url)).toEqual([
        `https://javstore.net/search?q=${encodeURIComponent(carNum)}`,
        "https://javstore.net/FC2-PPV-1234567.html",
    ]);
});
