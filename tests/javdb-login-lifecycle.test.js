// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import jquery from "jquery";
import { openJavDbLoginDialog } from "../src/features/detail/javdb-login-dialog.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const owners = [];
afterEach(() => { for (const owner of owners.splice(0)) owner.options.end(); document.body.replaceChildren(); });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function harness(login, credential, onSuccess, parent = new LifecycleScope("feature")) {
    const root = jquery("<div></div>").appendTo(document.body), busy = { close: vi.fn() };
    const owner = { root, options: null };
    const dialog = { open: options => { owner.options = options; root.html(options.content); options.success(root[0], owners.length + 1); return owners.length; }, close: () => owner.options.end() };
    const notifications = { ok: vi.fn(), error: vi.fn() }, logger = { error: vi.fn(), warn: vi.fn() };
    openJavDbLoginDialog({ dialog, account: { login }, credential, onSuccess, getScope: async () => parent, ui: { jquery, loading: () => busy, getResponsiveArea: value => value }, notifications, logger });
    root.find("#username").val("synthetic-user"); root.find("#password").val("synthetic-password");
    owners.push(owner);
    return { ...owner, notifications, click: () => root.find("button").trigger("click"), busy };
}

it("single-flights login and prevents closed account A from overwriting B", async () => {
    const a = deferred(), b = deferred(), login = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const credential = { set: vi.fn(async () => {}) }, successA = vi.fn(), successB = vi.fn();
    const first = harness(login, credential, successA);
    first.click(); first.click();
    await vi.waitFor(() => expect(login).toHaveBeenCalledOnce());
    const scopeA = login.mock.calls[0][2].scope;
    first.options.end();
    expect(scopeA.disposed).toBe(true);
    const second = harness(login, credential, successB);
    second.click();
    await vi.waitFor(() => expect(login).toHaveBeenCalledTimes(2));
    b.resolve({ success: true, token: "synthetic-B" });
    await vi.waitFor(() => expect(successB).toHaveBeenCalledOnce());
    a.resolve({ success: true, token: "synthetic-A" });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(credential.set).toHaveBeenCalledExactlyOnceWith("jhs_appAuthorization", "synthetic-B", { assertActive: expect.any(Function) });
    expect(successA).not.toHaveBeenCalled();
    expect(first.busy.close).toHaveBeenCalledOnce();
});

it("cancels a pending login when its feature is disposed without late feedback", async () => {
    const gate = deferred(), login = vi.fn(() => gate.promise), credential = { set: vi.fn() }, parent = new LifecycleScope("feature");
    const owner = harness(login, credential, vi.fn(), parent);
    owner.click(); await vi.waitFor(() => expect(login).toHaveBeenCalledOnce());
    parent.dispose(); gate.resolve({ success: true, token: "synthetic" });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(credential.set).not.toHaveBeenCalled();
    expect(owner.notifications.error).not.toHaveBeenCalled();
});
