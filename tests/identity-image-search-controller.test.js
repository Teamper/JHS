// @vitest-environment jsdom

import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { IdentityImageSearchController } from "../src/features/identity/identity-image-search-controller.js";

const $ = jquery;

describe("IdentityImageSearchController", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    it("owns the dialog UI, style, and dialog cleanup through the feature scope", async () => {
        const scope = new LifecycleScope("feature:identity"), styles = { register: vi.fn(() => vi.fn()) }, dialog = {
            open: vi.fn((options) => {
                document.body.innerHTML = options.content;
                options.success?.(document.body);
                return 7;
            }),
            close: vi.fn(),
        };
        const controller = new IdentityImageSearchController({ dialog, storage: {}, imageSearch: {}, styles, ui: { getJQuery: () => $, getUtils: () => ({}), getLoading: () => () => ({ close() {} }), show: {}, getClog: () => ({}) }, scope });

        await controller.start();
        controller.open();

        expect(styles.register).toHaveBeenCalledWith("identity-image-search", expect.stringContaining("#upload-area"));
        expect(dialog.open).toHaveBeenCalledOnce();
        expect(document.querySelector("#image-file")).not.toBeNull();
        scope.dispose();
        expect(dialog.close).toHaveBeenCalledWith(7);
        expect(styles.register.mock.results[0].value).toHaveBeenCalledOnce();
    });

    it("resolves image searches through the injected service and closes progress UI", async () => {
        const scope = new LifecycleScope("feature:identity"), progress = { close: vi.fn() }, resolve = vi.fn(async (source, options) => ({ source, options, targets: [] }));
        const controller = new IdentityImageSearchController({ dialog: { open: vi.fn() }, storage: {}, imageSearch: { resolve }, ui: { getLoading: () => vi.fn(() => progress), getUtils: () => ({}), show: {}, getClog: () => ({}) }, scope });

        await expect(controller.searchByImage("https://example.test/image.jpg")).resolves.toMatchObject({ source: "https://example.test/image.jpg", options: { scope } });
        expect(resolve).toHaveBeenCalledWith("https://example.test/image.jpg", { scope });
        expect(progress.close).toHaveBeenCalledOnce();
        scope.dispose();
    });
});
