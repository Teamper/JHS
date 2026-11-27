// @ts-check
import { getNowStr } from "../../core/ui-date-time.js";
import { App } from "@capacitor/app";
import { bootstrapJhs } from "../bootstrap.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { JavDbHostAdapter } from "../../platform/hosts/javdb-host-adapter.js";
import { AndroidHttpAdapter, android, installAndroidPorts, saveFile } from "../../platform/android/runtime.js";
import { NewVideoScanController } from "../../features/discovery/new-video-scan-controller.js";
import { ActorSourceHealth } from "../../features/discovery/actor-source-health.js";
import { TaskExecutionService } from "../../features/discovery/task-execution-service.js";
import { UnifiedOfflineController } from "../../features/external-bridge/unified-offline-controller.js";
import { OfflineTaskQueryService } from "../../services/offline-task-query-service.js";
import { ExternalUrlPolicy } from "../../services/external-url-policy.js";
import { parseDisabledPlugins, migrateDisabledPlugins } from "../../core/legacy-plugin-contributions.js";
import { CatalogClient } from "./catalog-client.js";
import { createRecentWorks, showBrowse, showActor, showLibrary, showActors } from "./library.js";
import { showDetail } from "./detail.js";
import { showMine, showTasks, showStats } from "./mine.js";
import { showNew, showHistory, showBlacklist } from "./collections.js";
import { mountLiquidNavigation } from "./liquid-navigation.js";
import { button, el } from "./components.js";
import { observeMovieTitles } from "./title-translation.js";
import { showSettings } from "./settings.js";
import { restoreWork, retainMovieSelection, visibleWork } from "./browse-controls.js";

const origin = "https://javdb.com";
/** @type {Record<string,string>} */
const tabLabels = { browse: "发现", new: "追新", library: "片库", mine: "我的" };
/** @type {Record<string,string>} */
const iconPaths = {
    browse: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    new: "M12 2v5m0 10v5M2 12h5m10 0h5M6 6l3 3m6 6 3 3M18 6l-3 3m-6 6-3 3",
    library: "M5 3h14v18l-7-4-7 4z",
    mine: "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 22v-1a8 8 0 0 1 16 0v1",
};
const labels = { ...tabLabels, actors: "演员收藏", actor: "演员作品", detail: "作品详情", tasks: "云盘任务", stats: "统计", history: "鉴定记录", blacklist: "黑名单与屏蔽规则", settings: "设置" };

/** @typedef {{name:string, scroll?:number, [key:string]:any}} MobileRoute */

async function start() {
    const main = /** @type {HTMLElement} */ (document.querySelector("#main"));
    const status = /** @type {HTMLElement} */ (document.querySelector("#status"));
    const title = /** @type {HTMLElement} */ (document.querySelector("#title"));
    const tabs = /** @type {HTMLElement} */ (document.querySelector(".mobile-tabs"));
    const back = /** @type {HTMLButtonElement} */ (document.querySelector("#back"));
    const mask = /** @type {HTMLButtonElement} */ (document.querySelector("#privacy"));
    const reveal = /** @type {HTMLButtonElement} */ (document.querySelector("#privacy-reveal"));
    const globals = /** @type {any} */ (globalThis);
    const nativeHttp = new AndroidHttpAdapter(new ExternalUrlPolicy());
    /** @type {Record<string,MobileRoute[]>} */
    const stacks = Object.fromEntries(Object.keys(tabLabels).map(name => [name, [{ name }]]));
    const accountReads = new Set();
    /** @type {LifecycleScope | undefined} */ let scope;
    /** @type {Promise<void> | null} */ let onlineWork = null;
    let loginPending = "";
    let cloudLoginVersion = 0;
    let foreground = true;
    let selectedNav = "browse";
    const currentStack = () => stacks[selectedNav];
    const currentRoute = () => currentStack().at(-1);
    function rememberPosition() {
        const route = currentRoute();
        if (!route) return;
        route.scroll = window.scrollY;
        route.anchor = visibleWork(main);
    }
    const external = (/** @type {string} */ url) => android.open({ url: new URL(url, origin).href });
    /** @param {string} url @returns {Promise<any>} */
    function open(url) {
        const target = new URL(url, origin);
        const movie = target.origin === origin && /^\/v\/([\w-]+)$/.exec(target.pathname);
        if (movie) return app.go({ name: "detail", record: { id: movie[1], url: target.href } });
        if (target.origin === origin && target.pathname === "/login") return app.login("javdb");
        return external(target.href);
    }

    await installAndroidPorts(nativeHttp, open);
    const host = new JavDbHostAdapter(document, new URL(origin));
    host.getWebAccountContext = () => ({ origin, accountUrl: origin + "/users/profile" });
    /** @type {(message: string) => void} */
    let reportDownloadError = message => { status.textContent = message; };
    const context = await bootstrapJhs({
        location: new URL(origin), bundledStyles: true,
        platform: {
            javdbHost: host, http: nativeHttp, navigation: { open, assign: open, replace: open },
            download: (/** @type {BlobPart | Blob} */ data, /** @type {string} */ filename) => {
                void saveFile(data, filename).catch(error => { if (error.code !== "ABORTED") reportDownloadError(error.message); });
            },
            createWorker: () => new Worker("sync-worker.js"), googleTranslationOnly: true,
            enabledFeatures: ["settings-entry", "settings-effects", "settings", "diagnostics", "library", "new-video", "movie-lists",
                "enhancement-settings", "personal-ratings", "privacy"],
        },
    });
    if (!context) throw new Error("移动端运行时启动失败");
    const services = context.services;
    const privacy = services.privacy;
    const events = context.container.resolveDeclared([SERVICE.events])[SERVICE.events];
    reportDownloadError = services.notifications.error;
    await services.webdavSync.initialize();
    services.webdavSync.start(context.rootScope, document, () => foreground && !document.hidden);
    const taskWindow = new Proxy(window, {
        get(target, key) {
            if (key === "isListPage") return true;
            if (key === "location") return new URL(origin);
            const value = Reflect.get(target, key, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
    const catalog = new CatalogClient(services.http);
    const scan = new NewVideoScanController({
        state: services.state, readTitleKeywords: () => services.keywordRules.getTitleKeywords(),
        actressInfo: {
            collection: services.actressInfo.collection.bind(services.actressInfo),
            lookupAny: services.actressInfo.lookupAny.bind(services.actressInfo),
            movies: async (/** @type {string} */ _provider, /** @type {{actorId: string}} */ { actorId },
                /** @type {{scope: LifecycleScope}} */ { scope }) => {
                const { items } = /** @type {{items: Record<string, any>[]}} */ (await catalog.read(`/v1/actors/${actorId}/movies`, {}, scope));
                return items.map(movie => ({ ...movie, publishTime: movie.releaseDate, score: movie.ratingValue }));
            },
        },
        preserveNewVideo: true, events, window,
        sourceHealth: new ActorSourceHealth(services.storage), scope: context.rootScope, logger: context.feedback.clog,
        getTimestamp: getNowStr, onNewItems() {},
    });
    const tasks = new TaskExecutionService({
        runtimeServices: { ...services, events, scope: () => context.rootScope, runWithoutPage: true,
            hostAdapters: { javdb: host, javbus: context.container.resolveDeclared([PORT.javbusHost])[PORT.javbusHost] } },
        getNewVideoScanner: () => scan,
        logger: context.feedback.clog, jquery: services.domUi.jquery, window: taskWindow, notifications: services.notifications,
    });
    context.rootScope.addCleanup(() => { tasks.dispose(); scan.dispose(); });
    const offlineTasks = new OfflineTaskQueryService({ offline: services.offline, settings: services.settings, storage: services.storage,
        token: () => services.pan123Credential.getStoredToken() });
    const offline = new UnifiedOfflineController({ ...services, events, hostAdapter: host, ui: services.domUi,
        submissionReceipts: services.offlineSubmissionReceipts, submissionSession: () => loginPending ? null : cloudLoginVersion,
        scope: context.rootScope });
    offline.start();

    const app = {
        openGallery: (/** @type {{urls:string[],initialIndex:number}} */ options) => android.openGallery(options),
        context, services, events, tasks, offline, offlineTasks, open, external,
        catalog,
        recentWorks: createRecentWorks(services.storage),
        async readCatalog(/** @type {string} */ path, /** @type {Record<string,string>} */ params,
            /** @type {LifecycleScope} */ owner, /** @type {HTMLElement} */ feedback, /** @type {() => unknown} */ retry) {
            if (loginPending === "javdb") return null;
            const reader = new LifecycleScope("android:catalog");
            const detach = owner.addCleanup(() => reader.dispose());
            accountReads.add(reader);
            feedback.replaceChildren();
            try { return await app.catalog.read(path, params, reader); }
            catch (error) {
                if (reader.disposed) return null;
                const failure = /** @type {{code?:string,message?:string}} */ (error);
                if (failure.code !== "AUTH_REQUIRED") {
                    feedback.append(el("p", failure.code === "CF_BLOCKED" ? "JavDB 拒绝了这次读取，请稍后重试" : failure.message || "目录读取失败"));
                    return null;
                }
                const signIn = button("登录 JavDB", () => app.run(owner, async () => {
                    signIn.disabled = true;
                    try { if (await app.login("javdb") && !owner.disposed) await retry(); }
                    finally { signIn.disabled = false; }
                }));
                feedback.append(el("p", "此页面需要 JavDB 登录"), signIn);
                return null;
            } finally {
                accountReads.delete(reader);
                detach();
                reader.dispose();
            }
        },
        command: (/** @type {string} */ id, /** @type {any} */ input = undefined) => context.registries.commands.execute(id, input),
        openLists: (/** @type {any[]} */ movies = []) => app.command("library.lists.open", { movies, login: () => app.login("javdb") }),
        async login(/** @type {string} */ site) {
            if (loginPending) return false;
            loginPending = site;
            try {
                if (site === "javdb") for (const reading of accountReads) reading.dispose();
                else {
                    cloudLoginVersion++;
                    await offlineTasks.resetProvider(site);
                }
                if (site === "one115") services.one115Match.clear();
                const result = await nativeHttp.login(site);
                if (!result.completed) return false;
                if (site === "one115") await services.offline.getAccountIdentity(site);
                else if (site === "pan123") {
                    const token = result.token ? JSON.parse(result.token) : "";
                    if (typeof token !== "string" || !token.trim()) throw new Error("123 云盘尚未返回授权，请登录后重试");
                    await services.pan123Credential.acceptLoginToken(token.trim());
                } else if (!(await services.javdbLists.access()).account) throw new Error("尚未确认 JavDB 登录，请登录后重试");
                return true;
            } finally {
                loginPending = "";
                if (site === "javdb") {
                    const active = currentRoute();
                    let refresh = false;
                    for (const route of Object.values(stacks).flat()) {
                        const first = route.firstSessionPage;
                        if (!first) continue;
                        if (route === active) { rememberPosition(); refresh = true; }
                        route.items.length = first.publicCount;
                        route.nextPage = first.page === 1 ? undefined : first.page;
                        delete route.firstSessionPage;
                        if (route.selection) retainMovieSelection(route.selection, route.items);
                    }
                    if (refresh) void render();
                }
            }
        },
        async run(/** @type {LifecycleScope | undefined} */ owner, /** @type {() => any} */ action) {
            if (owner?.disposed) return;
            const previous = status.textContent;
            status.textContent = "正在处理…";
            try {
                const value = await action();
                if (!owner?.disposed && status.textContent === "正在处理…") status.textContent = "";
                return value;
            } catch (error) {
                if (owner?.disposed) return;
                const failure = /** @type {{code?:string,name?:string,message?:string}} */ (error);
                status.textContent = failure.code === "ABORTED" || failure.name === "AbortError" ? previous : failure.message || "操作失败";
            }
        },
        go(/** @type {MobileRoute} */ state) {
            rememberPosition();
            currentStack().push(state);
            return render();
        },
        replace(/** @type {MobileRoute} */ state) {
            const stack = currentStack();
            stack[stack.length - 1] = state;
            return render();
        },
        back: () => returnView(),
        leaveSettings: () => returnView(true),
    };
    /** @type {Record<string,(state:MobileRoute,owner:LifecycleScope)=>any>} */
    const views = {
        browse: (s, owner) => showBrowse(main, app, s, owner),
        library: (s, owner) => showLibrary(main, app, s, owner),
        actors: (_s, owner) => showActors(main, app, owner),
        actor: (s, owner) => showActor(main, app, s, owner),
        detail: (s, owner) => showDetail(main, app, s, owner),
        tasks: (_s, owner) => showTasks(main, app, owner),
        stats: (_s, owner) => showStats(main, app, owner),
        mine: (_s, owner) => showMine(main, app, owner),
        settings: (s, owner) => showSettings(main, app, s, owner),
        new: (s, owner) => showNew(main, app, s, owner),
        history: (_s, owner) => showHistory(main, app, owner),
        blacklist: (_s, owner) => showBlacklist(main, app, owner),
    };
    const selectTab = (/** @type {string} */ name) => {
        if (selectedNav === name) return;
        rememberPosition();
        selectedNav = name;
        void render();
    };
    const updateNavigation = mountLiquidNavigation(tabs, tabLabels, iconPaths, selectTab, context.rootScope);
    async function render() {
        privacy.reveal(false);
        scope?.dispose();
        const owner = scope = new LifecycleScope("android:view");
        const stack = currentStack();
        const state = stack[stack.length - 1];
        document.body.dataset.route = state.name;
        title.textContent = /** @type {Record<string,string>} */ (labels)[state.name];
        back.hidden = stack.length <= 1;
        updateNavigation(selectedNav);
        status.textContent = "";
        main.replaceChildren();
        observeMovieTitles(main, services, owner);
        window.scrollTo(0, 0);
        await app.run(owner, () => views[state.name](state, owner));
        if (!owner.disposed && state.scroll) {
            window.scrollTo(0, state.scroll);
            restoreWork(main, state.anchor);
        }
    }
    function returnView(force = false) {
        const stack = currentStack();
        if (!force && currentRoute()?.handleBack?.()) return;
        if (stack.length > 1) { stack.pop(); void render(); }
        else if (selectedNav !== "browse") selectTab("browse");
        else void App.minimizeApp();
    }
    function closeMedia() {
        const preview = document.querySelector(".detail-trailer-player[open]");
        if (preview instanceof HTMLDialogElement) { preview.close(); return true; }
        const image = document.querySelector(".jhs-image-viewer .jhs-image-viewer-close");
        if (image instanceof HTMLButtonElement) { image.click(); return true; }
        return false;
    }
    const handleBack = () => {
        if (document.documentElement.hasAttribute("data-keyboard") && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
            return;
        }
        if (closeMedia()) return;
        const sheet = document.querySelector("dialog[open]");
        if (sheet instanceof HTMLDialogElement) { sheet.close(); return; }
        if (document.querySelector(".layui-layer")) {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
            return;
        }
        returnView();
    };
    back.onclick = handleBack;
    const backHandle = await App.addListener("backButton", handleBack);
    context.rootScope.addCleanup(() => { void backHandle.remove(); });
    let revealTimer = 0;
    const applyMask = () => {
        document.body.toggleAttribute("data-jhs-mobile-mask", privacy.masked);
        mask.setAttribute("aria-pressed", String(privacy.active && privacy.enabled));
        reveal.hidden = !privacy.active || !privacy.enabled;
        reveal.textContent = privacy.revealed ? "恢复遮罩" : "临时查看 10 秒";
        if (!privacy.revealed) window.clearTimeout(revealTimer);
        if (privacy.masked) {
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && focused.closest("[data-content-sensitive]")) focused.blur();
            closeMedia();
            for (const video of document.querySelectorAll("video")) video.pause();
        }
    };
    context.rootScope.listen(privacy, "privacy.changed", applyMask);
    mask.onclick = () => app.run(context.rootScope, () => app.command("privacy.toggle"));
    reveal.onclick = () => {
        if (!foreground || document.hidden || !privacy.active || !privacy.enabled) return;
        privacy.reveal(!privacy.revealed);
        if (privacy.revealed) revealTimer = window.setTimeout(() => privacy.reveal(false), 10_000);
    };
    context.rootScope.addCleanup(() => { window.clearTimeout(revealTimer); privacy.reveal(false); });
    applyMask();
    let wasOffline = !navigator.onLine;
    const wake = () => {
        if (!navigator.onLine) { wasOffline = true; return; }
        if (wasOffline) {
            wasOffline = false;
            services.http.resetConnectionFailures();
        }
        if (!foreground || document.hidden || onlineWork || loginPending) return;
        const disabled = migrateDisabledPlugins(parseDisabledPlugins(services.settings.snapshot().disabledPlugins));
        onlineWork = Promise.allSettled([
            disabled.includes("discovery.scheduler") ? null : tasks.doTask(), offlineTasks.refresh(),
        ]).then(() => { onlineWork = null; });
    };
    const stateHandle = await App.addListener("appStateChange", ({ isActive }) => {
        foreground = isActive;
        if (isActive) { services.webdavSync.schedule?.(0, true); wake(); }
        else {
            privacy.reveal(false);
            services.webdavSync.cancel();
        }
    });
    context.rootScope.addCleanup(() => { void stateHandle.remove(); });
    context.rootScope.listen(window, "online", wake);
    context.rootScope.listen(window, "offline", wake);
    context.rootScope.listen(document, "visibilitychange", wake);
    const clock = window.setInterval(wake, 60_000);
    context.rootScope.addCleanup(() => window.clearInterval(clock));
    context.rootScope.listen(document, "click", event => {
        const anchor = event.target instanceof Element ? /** @type {HTMLAnchorElement|null} */ (event.target.closest("a[href]")) : null;
        if (!anchor || event.defaultPrevented || anchor.hasAttribute("download")) return;
        const url = new URL(anchor.href);
        if (url.origin === location.origin || url.protocol !== "https:") return;
        event.preventDefault();
        void app.run(scope, () => open(url.href));
    });
    await render();
    wake();
}

void start().catch(error => {
    const status = document.querySelector("#status");
    if (status) status.textContent = error.message || "JHS 启动失败";
});
