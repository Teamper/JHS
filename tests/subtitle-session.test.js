// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { DetailPageActionsController } from "../src/features/detail/detail-page-actions-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const scopes = [];
afterEach(() => { scopes.forEach(scope => scope.dispose()); scopes.length = 0; vi.unstubAllGlobals(); document.body.innerHTML = ""; });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function harness() {
    const scope = new LifecycleScope("subtitle-owner"); scopes.push(scope);
    const dialogs = new Map(), tables = []; let nextId = 0;
    const dialog = {
        open: vi.fn(options => {
            const id = ++nextId, root = document.createElement("section");
            root.innerHTML = options.content; document.body.append(root);
            dialogs.set(id, { options, root }); options.success?.(root, id); return id;
        }),
        close: vi.fn(id => {
            const item = dialogs.get(id); if (!item) return;
            dialogs.delete(id); item.root.remove(); item.options.end?.();
        }),
    };
    vi.stubGlobal("Tabulator", class {
        constructor(root, options) {
            this.root = root; this.destroy = vi.fn(); tables.push(this);
            for (const data of options.data) {
                const cell = document.createElement("div"), callbacks = [];
                cell.innerHTML = options.columns.at(-1).formatter({ getData: () => data, getElement: () => cell }, {}, callback => callbacks.push(callback));
                root.append(cell); callbacks.forEach(callback => callback());
            }
        }
    });
    const download = vi.fn(async () => "subtitle"), notifications = { error: vi.fn() }, loader = { close: vi.fn() };
    const subtitle = { search: vi.fn(async () => [{ name: "test", extension: "srt", url: "https://example.test/sub.srt" }]), download };
    const ui = { loading: () => loader, getResponsiveArea: area => area, setupEscClose: vi.fn(), download: vi.fn() };
    const owner = new DetailPageActionsController({ hostAdapter: { document }, scope, dialog, subtitle, ui, notifications, diagnostics: { recordError: vi.fn() } });
    return { owner, scope, dialog, dialogs, tables, subtitle, ui, loader, notifications };
}

it.each(["preview", "download"])("cancels a pending subtitle %s when its table closes and ignores a late completion", async action => {
    const h = harness(), pending = deferred(); h.subtitle.download.mockReturnValue(pending.promise);
    await h.owner.searchXunLeiSubtitle("ABC-123");
    const old = h.dialogs.get(1), button = old.root.querySelector(`.subtitle-${action}-btn`);
    button.click(); const requestScope = h.subtitle.download.mock.calls[0][2].scope;
    h.dialog.close(1);
    expect(requestScope.disposed).toBe(true);
    await h.owner.searchXunLeiSubtitle("DEF-456");
    pending.resolve("late subtitle"); await flush();
    expect(h.dialogs.size).toBe(1); expect(h.dialogs.get(2)).toBeDefined();
    expect(h.ui.download).not.toHaveBeenCalled(); expect(h.notifications.error).not.toHaveBeenCalled();
    expect(h.tables[0].destroy).toHaveBeenCalledOnce();
    button.click(); expect(h.subtitle.download).toHaveBeenCalledOnce();
});

it("reports a direct download failure without rejecting its DOM event callback", async () => {
    const h = harness(); h.subtitle.download.mockRejectedValue(new Error("offline"));
    await h.owner.searchXunLeiSubtitle("ABC-123");
    h.dialogs.get(1).root.querySelector(".subtitle-download-btn").click(); await flush();
    expect(h.notifications.error).toHaveBeenCalledExactlyOnceWith("字幕下载失败，请重试");
    expect(h.ui.download).not.toHaveBeenCalled(); expect(h.dialogs.size).toBe(1);
});

it("owns each table independently and closes nested previews and listeners on feature disposal", async () => {
    const h = harness();
    await h.owner.searchXunLeiSubtitle("ABC-123"); await h.owner.searchXunLeiSubtitle("DEF-456");
    expect(h.tables[0].root).not.toBe(h.tables[1].root);
    h.dialogs.get(2).root.querySelector(".subtitle-preview-btn").click(); await flush();
    expect(h.dialogs.size).toBe(3);
    h.dialog.close(1); expect(h.dialogs.size).toBe(2);
    h.scope.dispose(); h.scope.dispose();
    expect(h.dialogs.size).toBe(0);
    h.tables.forEach(table => expect(table.destroy).toHaveBeenCalledOnce());
    expect(h.scope.snapshot().listeners).toBe(0);
});

it.each(["resolve", "reject"])("ignores a late search %s after the feature is disposed", async settle => {
    const h = harness(), pending = deferred(); h.subtitle.search.mockReturnValue(pending.promise);
    const task = h.owner.searchXunLeiSubtitle("ABC-123"); h.scope.dispose();
    pending[settle](settle === "resolve" ? [{ name: "late" }] : new Error("aborted"));
    await task;
    expect(h.dialog.open).not.toHaveBeenCalled(); expect(h.notifications.error).not.toHaveBeenCalled();
    expect(h.loader.close).toHaveBeenCalledOnce();
});

it("disposes an externally removed table and leaves a disposed owner inert", async () => {
    const h = harness(), pending = deferred(); h.subtitle.download.mockReturnValue(pending.promise);
    await h.owner.searchXunLeiSubtitle("ABC-123");
    h.dialogs.get(1).root.querySelector(".subtitle-preview-btn").click();
    const requestScope = h.subtitle.download.mock.calls[0][2].scope;
    h.dialogs.get(1).root.remove(); await flush();
    expect(requestScope.disposed).toBe(true); expect(h.tables[0].destroy).toHaveBeenCalledOnce();
    pending.resolve("late subtitle"); await flush();
    expect(h.dialogs.size).toBe(0);
    h.scope.dispose(); await h.owner.searchXunLeiSubtitle("ABC-123");
    expect(h.subtitle.search).toHaveBeenCalledOnce();
    expect(h.notifications.error).not.toHaveBeenCalled();
});
