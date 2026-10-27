// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { openJavDbLoginDialog } from "../src/features/detail/javdb-login-dialog.js";

function installLoginHarness({ successNoticeFailure = null, credentialFailure = null } = {}) {
    const root = jquery('<div><input id="username"><input id="password" type="password"><button id="loginBtn" type="button">登录</button></div>');
    let dialogOptions;
    const dialog = {
        open: vi.fn((options) => { dialogOptions = options; options.success(root[0], 7); return 7; }),
        close: vi.fn(() => dialogOptions.end()),
    };
    const account = { login: vi.fn(async () => ({ success: true, token: "synthetic-token" })) };
    const credential = { set: vi.fn(async () => { if (credentialFailure) throw credentialFailure; }) };
    const show = {
        ok: vi.fn(() => { if (successNoticeFailure) throw successNoticeFailure; }),
        error: vi.fn(),
    };
    const busy = { close: vi.fn() };
    const logger = { warn: vi.fn(), error: vi.fn() };
    vi.stubGlobal("$", jquery);
    vi.stubGlobal("utils", { getResponsiveArea: vi.fn(() => ["360px", "auto"]) });
    vi.stubGlobal("show", show);
    vi.stubGlobal("loading", vi.fn(() => busy));
    vi.stubGlobal("clog", logger);
    return { root, dialog, account, credential, show, busy, logger, getDialogOptions: () => dialogOptions };
}

describe("JavDB login post-commit boundary", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("closes the dialog and continues after a saved credential when the success notice fails", async () => {
        const { root, dialog, account, credential, show, busy } = installLoginHarness({ successNoticeFailure: new Error("toast unavailable") });
        const onSuccess = vi.fn(async () => {});
        openJavDbLoginDialog({ dialog, account, credential, getScope: async () => ({}), onSuccess });
        root.find("#username").val("synthetic-user");
        root.find("#password").val("synthetic-password");

        root.find("#loginBtn").trigger("click");
        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        expect(credential.set).toHaveBeenCalledWith("jhs_appAuthorization", "synthetic-token", { assertActive: expect.any(Function) });
        expect(dialog.close).toHaveBeenCalledWith(7);
        expect(show.error).not.toHaveBeenCalled();
        expect(busy.close).toHaveBeenCalledOnce();
    });

    it("keeps the login dialog open when credential persistence really fails", async () => {
        const failure = new Error("credential write failed");
        const { root, dialog, credential, show, busy, logger, getDialogOptions } = installLoginHarness({ credentialFailure: failure });
        const onSuccess = vi.fn();
        openJavDbLoginDialog({ dialog, account: { login: async () => ({ success: true, token: "synthetic-token" }) }, credential, getScope: async () => ({}), onSuccess });
        root.find("#username").val("synthetic-user");
        root.find("#password").val("synthetic-password");

        root.find("#loginBtn").trigger("click");
        await vi.waitFor(() => expect(show.error).toHaveBeenCalledWith("登录失败，请稍后重试"));
        expect(logger.error).toHaveBeenCalledWith("登录异常:", failure);
        expect(show.error.mock.calls.flat().join(" ")).not.toContain(failure.message);
        expect(dialog.close).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(busy.close).toHaveBeenCalledOnce();
        getDialogOptions().end();
    });

    it("reports a follow-up action failure without relabeling the saved login as failed", async () => {
        const { root, dialog, credential, show, busy, logger } = installLoginHarness();
        const failure = new Error("want action failed");
        const onSuccess = vi.fn(async () => { throw failure; });
        openJavDbLoginDialog({ dialog, account: { login: async () => ({ success: true, token: "synthetic-token" }) }, credential, getScope: async () => ({}), onSuccess });
        root.find("#username").val("synthetic-user");
        root.find("#password").val("synthetic-password");

        root.find("#loginBtn").trigger("click");
        await vi.waitFor(() => expect(show.error).toHaveBeenCalledWith("已登录，请重试刚才的操作"));
        expect(logger.error).toHaveBeenCalledWith("JavDB 登录后续操作失败", failure);
        expect(show.error.mock.calls.flat().join(" ")).not.toContain(failure.message);
        expect(credential.set).toHaveBeenCalledOnce();
        expect(dialog.close).toHaveBeenCalledWith(7);
        expect(busy.close).toHaveBeenCalledOnce();
    });

    it("runs from injected UI, notifications, and logger without ambient globals", async () => {
        const { root, dialog, account, credential, show, busy, logger } = installLoginHarness();
        const ui = { jquery, getResponsiveArea: () => ["360px", "auto"], loading: () => busy };
        vi.stubGlobal("$", undefined);
        vi.stubGlobal("utils", undefined);
        vi.stubGlobal("show", undefined);
        vi.stubGlobal("loading", undefined);
        vi.stubGlobal("clog", undefined);
        const onSuccess = vi.fn(async () => {});
        openJavDbLoginDialog({ dialog, account, credential, getScope: async () => ({}), onSuccess, ui, notifications: show, logger });
        root.find("#username").val("synthetic-user");
        root.find("#password").val("synthetic-password");

        root.find("#loginBtn").trigger("click");
        await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        expect(dialog.close).toHaveBeenCalledWith(7);
        expect(credential.set).toHaveBeenCalledOnce();
    });
});
