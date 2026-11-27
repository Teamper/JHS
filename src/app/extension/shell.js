// @ts-check
import { getDialogArea } from "../../core/dialog-shell.js";
import { bootstrapJhs, mountBootstrapError } from "../../app/bootstrap.js";
import { ExtensionClient } from "../../platform/extension/client.js";
import { LayerDialogAdapter } from "../../platform/userscript/layer-dialog-adapter.js";
import { ExtensionDialogAdapter } from "../../platform/extension/dialog-adapter.js";
import { getVendorRuntime } from "../../platform/userscript/vendor-runtime.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { normalizeCarNum } from "../../core/movie-identity.js";
import { createRemoteRuntime } from "./remote-runtime.js";
import { ExtensionMovieDrawer } from "./movie-drawer.js";
import {
    el,
    renderLibraryView,
    renderActorsView,
    renderTasksCloudView,
    renderStatsView,
    renderBackupView,
    renderPermissionsView,
    renderSidePanelCurrentView,
    renderSidePanelSearchView,
} from "./workbench-views.js";

/** @param {string} resource */
async function buildReceiptKey(resource) {
    if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) return null;
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(resource));
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return `jhs_offline_receipt_v1:${hex}`;
}

async function start() {
    const status = /** @type {HTMLElement} */ (document.querySelector("#status"));
    const content = /** @type {HTMLElement} */ (document.querySelector("#content"));
    const drawerRoot = /** @type {HTMLElement} */ (document.querySelector("#jhs-ext-drawer-root"));
    const nav = /** @type {HTMLElement} */ (document.querySelector("nav"));
    const side = location.pathname.endsWith("sidepanel.html");
    document.documentElement.setAttribute("data-jhs-runtime", "extension");

    const client = new ExtensionClient();
    const vendors = getVendorRuntime();
    /** @type {any} */ let context;
    const options = await createRemoteRuntime(client);
    context = await bootstrapJhs({
        ...options,
        location: new URL("https://javdb.com"),
        platform: {
            ...options.platform,
            createDialog: (/** @type {import("../../core/dialog-esc-controller.js").DialogEscController} */ dialogEsc) => new ExtensionDialogAdapter(new LayerDialogAdapter(vendors.layer, { getDialogArea }), {
                releaseEscClose: id => dialogEsc.releaseEscClose(id),
                jquery: vendors.$,
            }),
            enabledFeatures: [
                "settings-effects", "settings-entry", "settings", "diagnostics",
                "library", "new-video", "stats", "privacy",
                "enhancement-settings", "translation-tools", "personal-ratings", "movie-lists",
            ],
        },
    });
    /** @type {ExtensionDialogAdapter} */ const dialogAdapter = context.services.dialog;
    context.rootScope.listen(client, "disconnected", () => context.rootScope.dispose());
    /** @type {any} */ (globalThis).__jhsExtensionContext = context;

    let renderVersion = 0;
    let activeView = side ? "current" : "library";
    let parentView = "library";
    /** @type {LifecycleScope | null} */ let viewScope = null;
    /** @type {Map<string, {row: HTMLElement, button: HTMLButtonElement, badge: HTMLElement}>} */
    const navItems = new Map();

    /** @type {any} */
    const app = {
        client,
        context,
        coverCache: new Map(),
        coverFailed: new Set(),
        libraryState: { query: "", status: "all", prefix: "", sort: "updateDate:desc", viewMode: "grid", offset: 0 },
        actorState: { query: "", filter: "all", sort: "newCount:desc" },
        setStatus(/** @type {string} */ msg) {
            status.textContent = msg;
        },
        nextVersion() {
            return ++renderVersion;
        },
        isCurrentVersion(/** @type {number} */ version) {
            return version === renderVersion;
        },
        resetViewScope(/** @type {string} */ name) {
            viewScope?.dispose();
            viewScope = new LifecycleScope(`ext-view:${name}`);
            return viewScope;
        },
        async run(/** @type {() => any} */ action) {
            status.textContent = "处理中…";
            try {
                await action();
                status.textContent = "";
            } catch (error) {
                status.textContent = error instanceof Error ? error.message : String(error);
            }
        },
        async openMovieDrawer(/** @type {any} */ input) {
            await drawer.open(input);
        },
        async openInlineCommand(/** @type {string} */ command, /** @type {any} */ arg) {
            const allowed = await dialogAdapter.requestCloseInline();
            if (!allowed) return;
            const returnView = ["library", "actors", "tasks", "stats", "backup", "permissions"].includes(activeView) ? activeView : parentView;
            parentView = returnView;
            if (command === "new-video.open") activeView = "new-video";
            else if (command === "settings.open") activeView = "settings";
            else if (command === "library.history.open") activeView = "library";
            else if (command === "library.blacklist.open") activeView = "actors";
            syncNavActive();
            viewScope?.dispose();
            viewScope = null;

            const shell = el("div", undefined, "jhs-ext-inline-shell");
            const workspace = el("div", undefined, "jhs-ext-inline-workspace");
            if (["library.history.open", "library.blacklist.open"].includes(command)) {
                const bar = el("div", undefined, "jhs-ext-inline-backbar");
                const backBtn = el("button", `← 返回${returnView === "actors" ? "演员与黑名单" : "作品库"}`, "jhs-btn jhs-btn--ghost jhs-btn--sm");
                backBtn.type = "button";
                backBtn.addEventListener("click", () => { void app.navigate(returnView); });
                bar.append(backBtn);
                shell.append(bar);
            }
            shell.append(workspace);
            content.replaceChildren(shell);

            let suppressingCallback = false;
            dialogAdapter.setInlineHost(workspace, () => {
                if (suppressingCallback) return;
                if (activeView === "new-video" || activeView === "settings" || activeView === returnView) {
                    void app.navigate(returnView);
                }
            });
            try {
                await app.run(() => context.registries.commands.execute(command, arg));
            } catch (error) {
                suppressingCallback = true;
                dialogAdapter.setInlineHost(null);
                status.textContent = error instanceof Error ? error.message : String(error);
            }
        },
        async navigate(/** @type {string} */ viewId) {
            if (dialogAdapter.hasActiveInline()) {
                const allowed = await dialogAdapter.requestCloseInline();
                if (!allowed) return;
            }
            dialogAdapter.setInlineHost(null);
            activeView = viewId;
            if (["library", "actors", "tasks", "stats", "backup", "permissions"].includes(viewId)) parentView = viewId;
            syncNavActive();
            if (side) {
                if (viewId === "current") return app.run(() => renderSidePanelCurrentView(content, app));
                if (viewId === "search") return app.run(() => renderSidePanelSearchView(content, app));
                if (viewId === "tasks") return app.run(() => renderTasksCloudView(content, app, { compact: true }));
                return;
            }
            if (viewId === "library") return app.run(() => renderLibraryView(content, app));
            if (viewId === "new-video") return app.openInlineCommand("new-video.open");
            if (viewId === "actors") return app.run(() => renderActorsView(content, app));
            if (viewId === "tasks") return app.run(() => renderTasksCloudView(content, app));
            if (viewId === "stats") return app.run(() => renderStatsView(content, app));
            if (viewId === "backup") return app.run(() => renderBackupView(content, app));
            if (viewId === "permissions") return app.run(() => renderPermissionsView(content, app));
            if (viewId === "settings") return app.openInlineCommand("settings.open");
        },
        async refreshCurrentView() {
            if (dialogAdapter.hasActiveInline()) return;
            await app.navigate(activeView);
        },
        async quickSubmitOffline(/** @type {"pan123" | "one115"} */ integrationId, /** @type {string} */ resource, /** @type {any} */ movieInfo) {
            const providerId = integrationId === "pan123" ? "123" : "115";
            const providerName = integrationId === "pan123" ? "123 云盘" : "115 网盘";
            await app.run(async () => {
                const token = integrationId === "pan123" ? await context.services.pan123Credential.getStoredToken() : "";
                if (integrationId === "pan123" && !token) throw new Error("请先在 123 云盘网页同步登录授权");
                const receiptKey = await buildReceiptKey(resource);
                const prev = receiptKey ? await client.call("receipts.getRaw", [receiptKey]) : null;
                if (receiptKey) await client.call("receipts.write", [receiptKey, "pending", { attemptId: crypto.randomUUID(), providerId }, prev]);
                let submitted = false;
                const report = (/** @type {unknown} */ error) => context.services.diagnostics.recordError({ source: "extension-offline", message: "更新离线记录失败", error });
                try {
                    await context.services.offline.submitWithIntegration(integrationId, resource, { ...(token ? { token } : {}), scope: context.rootScope });
                    submitted = true;
                    if (receiptKey) await client.call("receipts.write", [receiptKey, "submitted", { attemptId: crypto.randomUUID(), providerId }, undefined]).catch(report);
                    await client.call("state.appendOfflineHistory", [{ carNum: movieInfo?.carNum || "", providerId, providerName, resource, status: "submitted", submissionOutcome: "submitted" }]);
                    if (movieInfo?.carNum) {
                        await client.call("state.patch", [movieInfo.carNum, { downloaded: true }, { type: "offline-mark-downloaded", record: { url: movieInfo.url, names: movieInfo.actress || "" } }]);
                    }
                    await app.refreshCurrentView();
                } catch (error) {
                    if (submitted) { report(error); app.setStatus("云盘已接收任务，本地记录未完整更新"); return; }
                    if (receiptKey) await client.call("receipts.write", [receiptKey, "failed", { attemptId: crypto.randomUUID(), providerId }, undefined]).catch(report);
                    throw error;
                }
            });
        },
    };

    const drawer = new ExtensionMovieDrawer({
        container: drawerRoot,
        client,
        context,
        mode: side ? "inline" : "drawer",
        onStatus: msg => { status.textContent = msg; },
        onFilterActor: name => {
            if (side) return;
            app.libraryState.query = name;
            app.libraryState.offset = 0;
            void app.navigate("library");
        },
        onMutated: () => {
            void updateBadges();
            if (!dialogAdapter.hasActiveInline() && ["library", "stats", "current", "search"].includes(activeView)) {
                void app.refreshCurrentView();
            }
        },
    });
    context.rootScope.addCleanup(() => {
        drawer.close();
        viewScope?.dispose();
        dialogAdapter.disposeInline();
    });

    const syncNavActive = () => {
        for (const [id, entry] of navItems) {
            const active = id === activeView;
            entry.row.classList.toggle("is-active", active);
            entry.button.setAttribute("aria-current", active ? "page" : "false");
        }
    };

    const updateBadges = async () => {
        if (side) return;
        try {
            const snap = await client.call("stats.snapshot");
            const setBadge = (/** @type {string} */ id, /** @type {number} */ count) => {
                const badge = navItems.get(id)?.badge;
                if (!badge) return;
                badge.textContent = count > 0 ? String(count) : "";
                badge.hidden = count <= 0;
            };
            setBadge("library", snap?.cars?.length || 0);
            setBadge("new-video", snap?.pendingNewVideos || 0);
            setBadge("actors", snap?.actresses?.length || 0);
        } catch { /* Keep the current badges when stats are unavailable. */ }
    };

    // Build Manager topbar (global quick code jump + sync pill + theme toggle)
    const topSearchHost = document.querySelector("#jhs-ext-topbar-search");
    const topMetaHost = document.querySelector("#jhs-ext-topbar-meta");
    if (!side && topSearchHost && topMetaHost) {
        const form = el("div", undefined, "jhs-ext-topbar-jump");
        const jumpInput = el("input", undefined, "jhs-field");
        jumpInput.type = "search";
        jumpInput.placeholder = "输入任意番号直达详情、预览与磁力（如 ABC-123）";
        jumpInput.setAttribute("aria-label", "番号直达");
        const jumpBtn = el("button", "直达详情", "jhs-btn jhs-btn--primary jhs-btn--sm");
        jumpBtn.type = "button";
        const triggerJump = () => {
            const code = normalizeCarNum(jumpInput.value);
            if (!code) { status.textContent = "请输入有效番号，如 ABC-123"; return; }
            status.textContent = "";
            void app.openMovieDrawer({ carNum: code });
        };
        context.rootScope.listen(jumpBtn, "click", triggerJump);
        context.rootScope.listen(jumpInput, "keydown", (/** @type {KeyboardEvent} */ e) => { if (e.key === "Enter") triggerJump(); });
        form.append(jumpInput, jumpBtn);
        topSearchHost.append(form);

        const syncPill = el("button", "同步待命", "jhs-badge jhs-badge--neutral jhs-ext-sync-pill");
        syncPill.type = "button";
        context.rootScope.listen(syncPill, "click", () => { void app.navigate("tasks"); });
        const refreshSyncPill = async () => {
            try {
                const sync = await client.call("sync.getStatus");
                syncPill.textContent = sync.lastSuccessAt ? "WebDAV 已同步" : (sync.message || "WebDAV 待配置");
            } catch { /* Keep the current status when the sync query fails. */ }
        };
        void refreshSyncPill();

        const themeBtn = el("button", "切换主题", "jhs-btn jhs-btn--ghost jhs-btn--sm");
        themeBtn.type = "button";
        const syncThemeLabel = () => {
            const mode = context.services.settings.snapshot().themeMode || "auto";
            themeBtn.textContent = mode === "dark" ? "暗色主题" : mode === "light" ? "亮色主题" : "跟随系统";
        };
        syncThemeLabel();
        context.rootScope.listen(themeBtn, "click", () => {
            const current = context.services.settings.snapshot().themeMode || "auto";
            const next = current === "dark" ? "light" : current === "light" ? "auto" : "dark";
            void context.services.settings.set("themeMode", next).then(syncThemeLabel);
        });
        context.rootScope.listen(context.services.settings, "settings.changed", syncThemeLabel);
        topMetaHost.append(syncPill, themeBtn);
    }

    // Build Navigation
    /** @type {Array<[string, string, () => any]>} */
    const entries = side ? [
        ["current", "当前作品", () => app.navigate("current")],
        ["search", "速查", () => app.navigate("search")],
        ["tasks", "任务", () => app.navigate("tasks")],
        ["manager", "管理页", () => chrome.tabs.create({ url: chrome.runtime.getURL("manager.html") })],
    ] : [
        ["library", "作品库", () => app.navigate("library")],
        ["new-video", "新作", () => app.navigate("new-video")],
        ["actors", "演员与黑名单", () => app.navigate("actors")],
        ["tasks", "后台任务", () => app.navigate("tasks")],
        ["stats", "数据统计", () => app.navigate("stats")],
        ["backup", "备份与迁移", () => app.navigate("backup")],
        ["permissions", "站点授权", () => app.navigate("permissions")],
        ["settings", "设置", () => app.navigate("settings")],
    ];

    for (const [id, label, action] of entries) {
        const row = el("div", undefined, "jhs-ext-nav-item");
        const btn = el("button", label, "jhs-btn jhs-btn--ghost jhs-extension-button");
        btn.type = "button";
        btn.addEventListener("click", () => { void action(); });
        const badge = el("span", "", "jhs-ext-nav-badge");
        badge.setAttribute("aria-hidden", "true");
        badge.hidden = true;
        row.append(btn, badge);
        nav.append(row);
        navItems.set(id, { row, button: btn, badge });
    }

    const refreshMovie = () => { if (activeView === "current") void app.run(() => renderSidePanelCurrentView(content, app)); };
    /** @type {Parameters<typeof chrome.tabs.onUpdated.addListener>[0]} */
    const updatedMovie = (_id, change, tab) => { if (tab.active && change.status === "complete") refreshMovie(); };
    if (side) {
        chrome.tabs.onActivated.addListener(refreshMovie);
        chrome.tabs.onUpdated.addListener(updatedMovie);
        context.rootScope.addCleanup(() => chrome.tabs.onActivated.removeListener(refreshMovie));
        context.rootScope.addCleanup(() => chrome.tabs.onUpdated.removeListener(updatedMovie));
    }

    await app.navigate(side ? "current" : "library");
    void updateBadges();
    status.textContent = "";

    client.addEventListener("event", event => {
        const type = /** @type {CustomEvent} */ (event).detail.type;
        if (type === "tasks-changed" && activeView === "tasks") void app.navigate("tasks");
        if (type === "car-state-changed" && !side && activeView === "library") {
            void app.navigate("library");
            void updateBadges();
        }
        if (type === "car-state-changed" && side) refreshMovie();
        if (type === "page-ready" && side) refreshMovie();
        if (type === "actress-changed" && activeView === "actors") {
            void app.navigate("actors");
            void updateBadges();
        }
        if (type === "new-video-changed") void updateBadges();
    });
    context.rootScope.listen(window, "pagehide", () => { context.rootScope.dispose(); client.dispose(); }, { once: true });
}
void start().catch(mountBootstrapError);
