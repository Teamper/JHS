// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { getJavDbWantWatchState, markJavDbWantWatch } from "../src/core/javdb-api.js";
import { Fc2WorkspaceService } from "../src/features/detail/fc2-workspace-service.js";

function installWantHarness({ cacheFailure = null, successNoticeFailure = null } = {}) {
    const gmRequest = vi.fn(async () => ({ success: 1 }));
    const deleteCachedRequest = vi.fn(async () => {
        if (cacheFailure) throw cacheFailure;
    });
    const show = {
        ok: vi.fn(() => { if (successNoticeFailure) throw successNoticeFailure; }),
        error: vi.fn(),
    };
    vi.stubGlobal("credentialService", { get: vi.fn(async () => "synthetic-token") });
    vi.stubGlobal("gmHttp", { gmRequest });
    vi.stubGlobal("storageManager", { deleteCachedRequest });
    vi.stubGlobal("md5", vi.fn(() => "synthetic-signature"));
    vi.stubGlobal("show", show);
    vi.stubGlobal("clog", { warn: vi.fn(), error: vi.fn() });
    return { gmRequest, deleteCachedRequest, show };
}

describe("JavDB want-watch post-commit boundary", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("returns remote success and remembers the state when local cache invalidation fails", async () => {
        const { gmRequest, deleteCachedRequest } = installWantHarness({ cacheFailure: new Error("cache unavailable") });

        await expect(markJavDbWantWatch("postcommit-cache-1")).resolves.toEqual({ success: 1 });
        await expect(getJavDbWantWatchState("postcommit-cache-1")).resolves.toBe(true);
        expect(deleteCachedRequest).toHaveBeenCalledWith("movie-detail:postcommit-cache-1");
        expect(gmRequest).toHaveBeenCalledTimes(1);
    });

    it("keeps the button committed when the success notice fails and prevents another remote write", async () => {
        const { gmRequest, show } = installWantHarness({ successNoticeFailure: new Error("toast unavailable") });
        const button = jquery('<button type="button" aria-pressed="false">JavDB 想看</button>');
        const service = new Fc2WorkspaceService();
        const context = { isAlive: () => true };

        await service.submitJavDbWant(context, "postcommit-toast-1", button);
        expect(button.attr("aria-pressed")).toBe("true");
        expect(button.text()).toBe("已加入 JavDB 想看");
        expect(show.error).not.toHaveBeenCalled();
        await service.submitJavDbWant(context, "postcommit-toast-1", button);
        expect(gmRequest).toHaveBeenCalledTimes(1);
    });

    it("submits the same movie once across concurrent workspace buttons", async () => {
        const { gmRequest } = installWantHarness();
        let finishRequest;
        gmRequest.mockImplementationOnce(() => new Promise((resolve) => { finishRequest = resolve; }));
        const service = new Fc2WorkspaceService(), context = { isAlive: () => true };
        const firstButton = jquery('<button type="button" aria-pressed="false">JavDB 想看</button>');
        const secondButton = jquery('<button type="button" aria-pressed="false">JavDB 想看</button>');

        const first = service.submitJavDbWant(context, "postcommit-concurrent-1", firstButton);
        await service.submitJavDbWant(context, "postcommit-concurrent-1", secondButton);
        await vi.waitFor(() => expect(gmRequest).toHaveBeenCalledOnce());
        finishRequest({ success: 1 });
        await first;
        await service.submitJavDbWant(context, "postcommit-concurrent-1", secondButton);

        expect(gmRequest).toHaveBeenCalledOnce();
        expect(firstButton.attr("aria-pressed")).toBe("true");
        expect(secondButton.attr("aria-pressed")).toBe("true");
    });

    it("allows a retry only when the remote request actually fails", async () => {
        const { gmRequest, show } = installWantHarness();
        gmRequest.mockRejectedValueOnce(new Error("network unavailable"));
        const button = jquery('<button type="button" aria-pressed="false">JavDB 想看</button>');
        const service = new Fc2WorkspaceService(), context = { isAlive: () => true };

        await service.submitJavDbWant(context, "postcommit-retry-1", button);
        expect(button.attr("aria-pressed")).toBe("false");
        expect(show.error).toHaveBeenCalledOnce();
        await service.submitJavDbWant(context, "postcommit-retry-1", button);
        expect(gmRequest).toHaveBeenCalledTimes(2);
        expect(button.attr("aria-pressed")).toBe("true");
    });

    it("keeps manual want action available when state lookup and warning output both fail", async () => {
        const { gmRequest } = installWantHarness();
        gmRequest.mockRejectedValueOnce(new Error("state lookup unavailable"));
        const logger = { warn: vi.fn(() => { throw new Error("logger unavailable"); }), error: vi.fn() };
        const service = new Fc2WorkspaceService({ runtimeServices: { logger } });
        const root = jquery('<div><button type="button" data-jhs-action="javdb-want">JavDB 想看</button></div>');
        const context = { root, isAlive: () => true, namespace: ".postcommit", carNum: "FC2-789" };

        await service.configureJavDbWantButton(context, Promise.resolve("postcommit-statewarn-1"));
        const button = root.find('[data-jhs-action="javdb-want"]');
        expect(button.prop("disabled")).toBe(false);
        expect(button.text()).toBe("JavDB 想看");
        expect(logger.warn).toHaveBeenCalledOnce();
        expect(logger.error).not.toHaveBeenCalled();
    });
});
