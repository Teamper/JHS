// @ts-check
import { getMovieStateEligibility } from "../../core/movie-identity.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { extractInfoHash } from "../../services/magnet-source-registry.js";
import { SubtitleWorkspaceController } from "../../features/detail/subtitle-workspace-controller.js";
import { SubtitleUploadController } from "../../features/detail/subtitle-upload-controller.js";
import { SUBTITLE_WORKSPACE_STYLES } from "../../ui/detail/subtitle-workspace.js";
import { subtitleUploadEnabled } from "../../core/enhancement-controls.js";
import { android, saveFile } from "../../platform/android/runtime.js";
import { saveWebReview } from "./web-account.js";
import { button, el, image, input, select, sheet, STATE_LABELS, validHttps } from "./components.js";
import { mountDetailMedia } from "./detail-media.js";
import { movieTitle } from "./title-translation.js";
import { renderMoviePoster } from "./movie-poster.js";
import { followActions } from "./collections.js";

/** @param {any} app @param {any} record @param {string|null} javBusUrl @param {LifecycleScope} scope @param {boolean} [session] */
async function loadMovie(app, record, javBusUrl, scope, session = false) {
    if (javBusUrl && record.carNum) {
        let original;
        try {
            original = await app.context.registries.integrations.getAdapter("javbus").getDetail({ carNum: record.carNum, url: javBusUrl }, { scope });
        } catch (error) {
            scope.assertActive();
            if (!navigator.onLine || /** @type {{code?:string}} */ (error)?.code === "ABORTED") throw error;
        }
        scope.assertActive();
        if (original && getMovieStateEligibility(original).eligible) {
            if (original.carNum !== record.carNum) throw new Error("JavBus 番号与已保存记录不一致");
            if ((original.title && original.title !== record.carNum) || original.coverUrl || original.stills?.length) return original;
        }
    }
    const match = typeof record.url === "string" ? /^https:\/\/javdb\.com\/v\/([\w-]+)(?:[?#]|$)/.exec(record.url) : null;
    const id = !javBusUrl && (record.id || match?.[1]);
    if (id) return app.catalog.read("/v1/movies/" + id, {}, scope, { session });
    if (getMovieStateEligibility(record).eligible) {
        const search = await app.catalog.read("/v1/search", { q: record.carNum }, scope, { session });
        scope.assertActive();
        const exact = search.items.filter((/** @type {any} */ movie) => movie.carNum === record.carNum && movie.stateEligibility.eligible);
        const matches = new Set(exact.map((/** @type {any} */ movie) => movie.id));
        if (matches.size > 1) throw new Error("JavDB 有多部同番号作品，暂不能补齐资料");
        if (matches.size === 1) return app.catalog.read("/v1/movies/" + matches.values().next().value, {}, scope, { session });
    }
    throw new Error("未找到可确认的 JavDB 详情");
}

/** @param {HTMLElement} root @param {any} app @param {any} state @param {LifecycleScope} scope */
export async function showDetail(root, app, state, scope) {
    const { services } = app;
    const record = state.record;
    const originalUrl = validHttps(record.url);
    const javBusUrl = originalUrl && /(?:^|\.)javbus\.com$/.test(new URL(originalUrl).hostname) ? originalUrl : null;
    /** @type {any} */ let movie;
    /** @type {LifecycleScope | undefined} */ let toolsScope;
    let pending = false;
    let hydrated = false;
    try {
        movie = state.saved ? { ...record, id: null, title: record.title || record.names || record.carNum } : await loadMovie(app, record, javBusUrl, scope);
        if (record.carNum && movie.carNum !== record.carNum) throw new Error("源站番号与已保存记录不一致");
    } catch (error) {
        scope.assertActive();
        const failure = /** @type {{code?:string,message?:string}} */ (error);
        const login = failure.code === "AUTH_REQUIRED";
        root.append(el("p", login ? "此作品需要 JavDB 登录" : !navigator.onLine ? "当前离线" : failure.message || "无法读取作品详情", "empty"),
            button(login ? "登录 JavDB" : "重试", () => app.run(scope, async () => {
                if ((!login || await app.login("javdb")) && !scope.disposed) await app.replace(state);
            })));
        return;
    }
    scope.assertActive();
    if (!state.saved) app.recentWorks.remember(movie);
    const hero = el("section", null, "movie-hero");
    const facts = el("div");
    const mediaArea = el("section", null, "section");
    mediaArea.append(el("h2", "预告与画面", "catalog-heading"));
    const media = mountDetailMedia(mediaArea, app, scope, refreshOnline, (id, owner) => app.catalog.readPreview(id, owner));
    const details = el("div");
    const cast = () => (movie.actors || []).map((/** @type {{name:string}} */ actor) => actor.name);
    const context = () => ({ ...movie, movieId: movie.id, providerId: movie.providerId || "javdb", detailUrl: movie.url,
        actress: cast().join(" "), publishTime: movie.releaseDate || "" });
    const metadata = () => {
        if (state.saved && !hydrated) return { url: record.url, names: record.names };
        const names = cast();
        const actorNames = [...(Array.isArray(record.actorNames) ? record.actorNames : []), ...names];
        return { url: javBusUrl ? record.url : movie.url, names: [movie.title, names.join(" ")].filter(Boolean).join(" · "),
            title: movie.title || undefined, publishTime: movie.releaseDate || undefined, actorNames };
    };
    function renderHero() {
        hero.replaceChildren();
        const identity = el("div", null, "movie-identity");
        identity.append(movieTitle("h2", movie.title, movie.carNum));
        if (movie.carNum) identity.append(el("p", movie.carNum, "movie-code"));
        identity.dataset.contentSensitive = "";
        if (movie.coverUrl) {
            const cover = image(movie.coverUrl, "cover-large");
            cover.dataset.contentSensitive = "";
            hero.append(cover);
        }
        hero.append(identity);
    }
    const eligible = movie.stateEligibility ?? getMovieStateEligibility(movie.carNum);
    renderHero();
    media.update(movie, Boolean(state.saved));
    if (!eligible.eligible) {
        root.append(hero, el("p", "番号未确认，状态编辑暂不可用", "empty"), facts, mediaArea, details);
        renderTools();
        return;
    }
    const carNum = movie.carNum;
    const controls = el("div", null, "detail-controls");
    const flags = el("div", null, "actions detail-states");
    const stateButtons = new Map();
    const refresh = async () => {
        const saved = await services.state.getState(carNum);
        if (scope.disposed) return;
        for (const [flag, trigger] of stateButtons) {
            const enabled = !!saved?.stateFlags?.[flag];
            trigger.setAttribute("aria-pressed", String(enabled));
            if (flag === "favorite") trigger.textContent = enabled ? "已收藏" : "收藏";
        }
    };
    for (const [flag, label] of Object.entries(STATE_LABELS)) {
        const action = button(label, () => app.run(scope, async () => {
            await services.state.toggle(carNum, flag, { record: metadata(), preserveNewVideo: true, keepExistingNames: true });
            await refresh();
        }), flag === "favorite" ? "primary" : "quiet-action");
        stateButtons.set(flag, action);
        flags.append(action);
    }
    const note = el("textarea");
    note.setAttribute("aria-label", "备注");
    note.dataset.contentSensitive = "";
    note.placeholder = "备注";
    const rating = select([["0", "未评分"], ...[1, 2, 3, 4, 5].map(n => [String(n), String(n) + " 星"])], "个人评分");
    const [saved, ratings] = await Promise.all([services.state.getState(carNum), services.state.getPersonalRatings()]);
    scope.assertActive();
    let remark = saved?.remark ?? "";
    let currentRating = ratings[carNum]?.rating ?? 0;
    rating.value = String(currentRating);
    rating.onchange = () => app.run(scope, async () => {
        rating.disabled = true;
        const picked = Number(rating.value);
        try {
            await services.state.setPersonalRating([carNum], picked || null);
            currentRating = picked;
            if (!scope.disposed) services.notifications.ok(picked ? "评分已保存" : "评分已清除");
        } finally {
            rating.value = String(currentRating);
            rating.disabled = false;
        }
    });
    const noteEditor = sheet(root, "作品备注", scope);
    const noteSummary = el("p", remark, "saved-movie-note");
    noteSummary.hidden = !remark;
    noteSummary.dataset.contentSensitive = "";
    const edit = button(remark ? "编辑备注" : "写备注", () => {
        note.value = remark;
        noteEditor.showModal();
    }, "quiet-action");
    const personal = el("div", null, "actions section");
    const saveNote = button("保存备注", () => app.run(scope, async () => {
        saveNote.disabled = true;
        try {
            const existing = await services.state.getState(carNum);
            scope.assertActive();
            const source = metadata();
            await services.state.patch(carNum, {}, {
                record: { ...(existing ? { actorNames: source.actorNames } : source), remark: note.value },
                replaceMetadata: true, keepExistingNames: true,
            });
            if (scope.disposed) return;
            remark = note.value;
            noteSummary.textContent = remark;
            noteSummary.hidden = !remark;
            edit.textContent = remark ? "编辑备注" : "写备注";
            noteEditor.close();
            services.notifications.ok("备注已保存");
        } finally { saveNote.disabled = false; }
    }), "primary");
    noteEditor.append(note, saveNote);
    personal.append(rating, edit);
    controls.append(flags, personal);
    controls.append(noteSummary);
    root.append(hero, controls);
    if (state.queue) root.append(followActions(record, app, state.queue, scope, () => app.back()));
    root.append(facts, mediaArea, details);
    await refresh();
    const accounts = el("div", null, "actions");
    const accountLabel = el("p", "JavDB 账号", "empty");
    const checkAccount = async () => {
        const access = await services.javdbLists.access(scope);
        scope.assertActive();
        accountLabel.textContent = access.account?.label || "JavDB 未登录";
    };
    const want = button("JavDB 想看", () => app.run(scope, () => markOnSite("want")));
    const watched = button("JavDB 看过", () => app.run(scope, () => markOnSite("watched")));
    /** @param {"want"|"watched"} kind */
    async function markOnSite(kind) {
        const score = Number(rating.value);
        if (kind === "watched" && !score) throw new Error("请先选择用于原站的评分");
        want.disabled = watched.disabled = true;
        try {
            const message = await saveWebReview(movie.id, kind, score, app, scope);
            scope.assertActive();
            services.notifications.info(message);
        } finally { want.disabled = watched.disabled = false; }
    }
    accounts.append(button("核对账号", () => app.run(scope, checkAccount)),
        button("存入清单", () => app.run(scope, () => app.openLists([context()]))), want, watched);
    scope.addCleanup(app.events.on("car-state-changed", refresh));
    function renderTools() {
        toolsScope?.dispose();
        const owner = toolsScope = newScope(scope);
        details.replaceChildren();
        const tags = el("div", null, "surface");
        tags.dataset.contentSensitive = "";
        for (const field of movie.fields || []) tags.append(el("div", field.label + " " + field.value, "data-row"));
        const actors = el("div", null, "actions");
        for (const actor of movie.actors || []) if (actor.id) actors.append(button(actor.name, () => { void app.go({ name: "actor", actor }); }));
        if (actors.childElementCount) tags.append(actors);
        facts.replaceChildren(el("h2", "发行资料", "catalog-heading"));
        if (tags.childElementCount) facts.append(tags);
        else facts.append(el("p", movie.releaseDate || "暂无发行资料", "empty"));
        if (javBusUrl) {
            const sources = el("div", null, "actions");
            if (movie.id) sources.append(el("span", "资料来自 JavDB", "movie-metadata"));
            sources.append(button("打开 JavBus 原链接", () => app.run(owner, () => app.external(javBusUrl)), "quiet-action"));
            facts.append(sources);
        }
        if (eligible.eligible) {
            accountLabel.hidden = accounts.hidden = !movie.id;
            details.append(accountLabel, accounts);
            if (movie.id || movie.providerId === "javbus") {
                mountTools(details, app, context(), state, owner);
                return;
            }
        }
        const source = validHttps(movie.url);
        if (source && !javBusUrl) details.append(button("打开来源", () => app.run(owner, () => app.external(source))));
    }
    async function refreshOnline(session = false) {
        if (scope.disposed || pending) return;
        pending = true;
        try {
            const next = await loadMovie(app, record, javBusUrl, scope, session);
            scope.assertActive();
            if (record.carNum && (next.carNum !== record.carNum || !(next.stateEligibility ?? getMovieStateEligibility(next)).eligible)) {
                throw new Error("源站番号与已保存记录不一致");
            }
            movie = next;
            hydrated = true;
            renderHero();
            media.update(movie);
            renderTools();
        } catch (error) {
            if (!scope.disposed) media.loadFailed(error);
        } finally { pending = false; }
    }
    renderTools();
    if (state.saved) {
        const hydrateWhenVisible = () => {
            if (!hydrated && !document.hidden && navigator.onLine) void refreshOnline();
        };
        if (!navigator.onLine) media.loadFailed(new Error("当前离线"));
        scope.listen(window, "online", hydrateWhenVisible);
        scope.listen(document, "visibilitychange", hydrateWhenVisible);
        hydrateWhenVisible();
    }
}

/** @param {HTMLElement} root @param {any} app @param {any} movie @param {any} state @param {LifecycleScope} scope */
function mountTools(root, app, movie, state, scope) {
    const s = app.services;
    const settings = () => s.settings.snapshot();
    const tools = el("div", null, "actions section"), output = el("div", null, "surface");
    const segments = el("nav", null, "detail-navigation actions");
    segments.setAttribute("aria-label", "详情内容");
    const comment = el("div", null, "surface");
    const information = el("div", null, "actions section");
    output.hidden = true;
    /** @type {LifecycleScope | undefined} */ let subsection;
    /** @param {string} label @param {(owner:LifecycleScope)=>Promise<void>} load @param {HTMLElement} [destination] */
    function tool(label, load, destination = tools) {
        const action = button(label, () => {
            subsection?.dispose();
            const owner = subsection = newScope(scope);
            output.hidden = false;
            output.replaceChildren();
            void app.run(owner, async () => {
                await load(owner);
                owner.assertActive();
                if (!output.childElementCount) output.append(el("p", "暂无结果", "empty"));
            });
        }, "quiet-action");
        destination.append(action);
        return action;
    }
    const external = (/** @type {string} */ url, /** @type {string} */ label) => button(label, () => app.run(scope, () => app.external(url)));
    const loadComments = tool("读取评论", async owner => {
        const items = await s.review.list(movie, { scope: owner });
        owner.assertActive();
        for (const row of items) output.append(el("div", row.author + " · " + row.content, "data-row"));
    }, comment);
    tool("相关清单", async owner => {
        const items = await s.related.list(movie, { scope: owner });
        owner.assertActive();
        for (const row of items) output.append(el("div", row.name + " · " + row.movieCount + " 部", "data-row"));
    }, information);
    tool("磁力与离线", async owner => {
        const native = (movie.magnets || []).map((/** @type {any} */ row) => ({ magnet: row.uri, title: row.name, size: row.meta }));
        const found = await s.magnet.search(movie, { scope: owner, settings: settings() });
        owner.assertActive();
        const keys = new Set();
        for (const row of [...native, ...found]) {
            const resource = row.magnet || row.uri;
            if (typeof resource !== "string" || !/^(?:magnet:|ed2k:)/i.test(resource)) continue;
            const hash = extractInfoHash(resource) || resource;
            if (keys.has(hash)) continue;
            keys.add(hash);
            const entry = el("div", null, "data-row");
            const copy = button("复制", () => app.run(owner, () => s.clipboard.copyText("磁力链接", resource)));
            const send = button("云盘离线", event => app.run(owner, async () => {
                send.disabled = true;
                try {
                    const check = await app.offline.checkPendingSubmission(resource, owner);
                    owner.assertActive();
                    if (check?.found) {
                        s.notifications.info("已在 115 云端找到任务");
                        return;
                    }
                    await app.offline.submitResource(event, resource, s.domUi.jquery(send), movie,
                        check?.receipt.attemptId ?? null,
                        check ? { preferredProviderId: check.receipt.providerId, expectedReceipt: check.raw } : {});
                } finally { send.disabled = false; }
            }));
            entry.append(el("p", [row.title, row.size].filter(Boolean).join(" · ")), copy, send);
            output.append(entry);
        }
    });
    tools.append(button("字幕", event => app.run(scope, () => {
        scope.addCleanup(s.styles.register("android-subtitle", SUBTITLE_WORKSPACE_STYLES));
        const ui = s.domUi, dialog = s.dialog;
        const uploader = new SubtitleUploadController({ document, dialog, ui, settings: s.settings, matching: s.one115Match, uploads: s.subtitleUpload });
        const controller = new SubtitleWorkspaceController({ document, scope, subtitle: s.subtitle, dialog, ui, download: saveFile,
            uploadEnabled: () => subtitleUploadEnabled(settings()), upload: (/** @type {any} */ args) => uploader.open(args), uploadRecords: (/** @type {any} */ args) => uploader.openRecords(args) });
        controller.open({ carNum: movie.carNum, trigger: /** @type {HTMLElement} */ (event.currentTarget) });
    })));
    tool("115 文件", async owner => {
        const load = async (/** @type {any} */ continuation) => {
            const result = await s.one115Match.matchMovie(movie, { scope: owner, continuation });
            owner.assertActive();
            output.replaceChildren();
            for (const file of result.matches) {
                const row = el("div", null, "data-row");
                row.append(el("p", file.name));
                const play = validHttps(s.offline.getPlayUrl("one115", file));
                if (play) row.append(button("播放", () => app.run(owner, async () => {
                    const identity = await s.offline.getAccountIdentity("one115", { scope: owner });
                    if (String(identity.accountId) !== file.accountId) throw new Error("115 账号已切换，请重新匹配");
                    await android.play115({ url: play });
                })));
                const name = input("text", "新文件名", file.name);
                row.append(name, button("改名", () => app.run(owner, async () => {
                    const value = name.value.trim();
                    if (!value || value === file.name) return;
                    const identity = await s.offline.getAccountIdentity("one115", { scope: owner });
                    if (String(identity.accountId) !== file.accountId) throw new Error("115 账号已切换，请重新匹配");
                    await s.offline.renameFile("one115", file.fileId, value, { scope: owner, expectedAccountId: file.accountId });
                    s.one115Match.clear();
                    await load(null);
                })));
                output.append(row);
            }
            if (result.continuation) output.append(button("继续匹配", () => app.run(owner, () => load(result.continuation))));
        };
        await load(null);
    });
    tool("媒体库", async owner => {
        const result = await s.mediaLibrary.queryMovie(movie, { scope: owner });
        owner.assertActive();
        for (const hit of result.hits) output.append(external(hit.url, hit.serverName + " · " + hit.name));
        if (!result.hits.length) output.append(el("p", result.servers.find((/** @type {any} */ server) => server.error)?.error || (result.status === "absent" ? "未入库" : "媒体库未连接")));
    });
    output.dataset.contentSensitive = "";
    const panels = [el("section"), el("section"), el("section")];
    panels[0].append(information);
    if (movie.recommendations?.length) {
        const works = el("div", null, "poster-grid related-works");
        for (const record of movie.recommendations) {
            works.append(renderMoviePoster(record, () => { void app.go({ name: "detail", record }); }));
        }
        panels[0].append(el("h2", "相关作品", "catalog-heading"), works);
    }
    panels[1].append(tools);
    panels[2].append(comment);
    const controls = ["相关", "资源", "评论"].map((label, index) => button(label, () => show(index)));
    function show(/** @type {number} */ index) {
        subsection?.dispose();
        state.section = index;
        output.hidden = true;
        output.replaceChildren();
        for (let i = 0; i < panels.length; i++) {
            panels[i].hidden = i !== index;
            controls[i].setAttribute("aria-pressed", String(i === index));
        }
        if (index === 0) information.after(output);
        else panels[index].append(output);
        if (index === 2) loadComments.click();
    }
    segments.append(...controls);
    root.append(segments, ...panels);
    show(state.section || 0);
}

/** @param {LifecycleScope} parent */
function newScope(parent) {
    const child = new LifecycleScope("detail-tool");
    const release = parent.addCleanup(() => child.dispose());
    child.addCleanup(release);
    return child;
}
