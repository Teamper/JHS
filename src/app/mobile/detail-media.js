// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { getMovieStateEligibility } from "../../core/movie-identity.js";
import { safePlay } from "../../core/feature-helpers.js";
import { canUseDmmPreview, canUsePreview, fetchDmmPreviewIfEnabled, invalidateDmmPreview, Z } from "../../services/preview-service.js";
import { button, el, image, select, validHttps } from "./components.js";
import { openHls } from "./trailer-stream.js";

/** @typedef {{url:string,hls?:boolean}} TrailerSource */
/** @typedef {{sources:()=>TrailerSource[], ready:Promise<void>, needsLogin:()=>boolean}} TrailerAvailability */

const rejectedPreviewStatuses = [401, 403, 404, 410];

/** @param {any} http @param {string} url @param {LifecycleScope} scope */
async function isDmmVideoRejected(http, url, scope) {
    try {
        const result = await http.request({
            url, method: "HEAD", providerId: "android-trailer", responseType: "text", timeout: 4500,
            retryCount: 0, acceptableStatuses: rejectedPreviewStatuses,
            requestOptions: { anonymous: true, redirect: "error" },
            urlPolicy: { trustClass: "custom-public", expectedOrigin: new URL(url).origin, expectedUrl: url },
        }, scope);
        return rejectedPreviewStatuses.includes(result.status);
    } catch {
        scope.assertActive();
        // Some CDNs support playback without accepting HEAD requests.
        return false;
    }
}

/** @param {HTMLElement} slot @param {string} text @param {string} [action] @param {() => unknown} [callback] */
function status(slot, text, action, callback) {
    const message = el("span", text, "detail-media-message");
    message.setAttribute("role", "status");
    slot.replaceChildren(message);
    if (action && callback) slot.append(button(action, callback));
}

/** @param {HTMLElement} slot @param {string} label @param {string|null} thumbnail @param {(trigger:HTMLButtonElement)=>unknown} action @param {boolean} [play] */
function tile(slot, label, thumbnail, action, play = false) {
    const trigger = button("", () => action(trigger), "detail-media-tile");
    trigger.setAttribute("aria-label", play ? "播放" + label : "查看图片");
    const frame = el("span", null, "detail-media-frame");
    frame.append(image(thumbnail, "detail-media-image"));
    if (play) {
        const icon = el("span", "▶", "detail-media-play");
        icon.setAttribute("aria-hidden", "true");
        frame.append(icon);
    }
    trigger.append(frame);
    if (play) trigger.append(el("span", label, "detail-media-label"));
    slot.replaceChildren(trigger);
    return trigger;
}

/** @param {any} http @param {TrailerAvailability} availability @param {string|null} poster @param {HTMLButtonElement} trigger @param {LifecycleScope} owner @param {()=>void} retry @param {()=>unknown} login */
function openTrailer(http, availability, poster, trigger, owner, retry, login) {
    const scope = new LifecycleScope("android:trailer-player");
    const dialog = el("dialog", null, "detail-trailer-player");
    dialog.setAttribute("aria-label", "预告播放器");
    const close = button("关闭", () => dialog.close());
    const player = el("video");
    player.controls = true;
    player.playsInline = true;
    player.setAttribute("controlslist", "nofullscreen");
    if (poster) player.poster = poster;
    const feedback = el("div", null, "detail-trailer-feedback");
    dialog.append(close, player, feedback);
    document.body.append(dialog);
    /** @type {ReturnType<typeof openHls>|undefined} */ let stream;
    const release = owner.addCleanup(() => {
        scope.dispose();
        stream?.destroy();
        player.pause();
        player.removeAttribute("src");
        player.load();
        dialog.remove();
        if (!owner.disposed && trigger.isConnected && !document.body.hasAttribute("data-jhs-mobile-mask")) {
            trigger.focus({ preventScroll: true });
        }
    });
    scope.listen(dialog, "close", release);
    scope.listen(document, "visibilitychange", () => { if (document.hidden) player.pause(); });
    const attempted = new Set();
    let sourcesPending = true;
    let waiting = false;
    void availability.ready.then(() => {
        sourcesPending = false;
        if (waiting) { waiting = false; play(); }
    });
    function play() {
        if (scope.disposed || waiting) return;
        stream?.destroy();
        stream = undefined;
        const source = availability.sources().find(candidate => !attempted.has(candidate.url));
        if (!source) {
            if (sourcesPending) {
                waiting = true;
                status(feedback, "正在查找其他预告来源");
                return;
            }
            const needsLogin = availability.needsLogin();
            status(feedback, needsLogin ? "原站预告需要登录" : "预告暂时无法播放", needsLogin ? "登录 JavDB" : "重试", () => {
                dialog.close();
                (needsLogin ? login : retry)();
            });
            return;
        }
        attempted.add(source.url);
        feedback.replaceChildren();
        if (source.hls || new URL(source.url).pathname.endsWith(".m3u8")) {
            stream = openHls(http, source.url, player, () => {
                if (!scope.disposed && !document.hidden) void safePlay(player);
            }, () => queueMicrotask(play));
        } else {
            player.src = source.url;
            void safePlay(player);
        }
    }
    scope.listen(player, "error", () => { if (!stream) play(); });
    dialog.showModal();
    play();
}

/** @param {HTMLElement} root @param {any} app @param {LifecycleScope} scope @param {(session?:boolean)=>Promise<void>} retryDetail @param {(id:string,owner:LifecycleScope)=>Promise<any>} readSessionPreview */
export function mountDetailMedia(root, app, scope, retryDetail, readSessionPreview) {
    const services = app.services;
    const rail = el("section", null, "detail-media");
    rail.setAttribute("aria-label", "作品画面");
    const trailer = el("div", null, "detail-media-item");
    trailer.dataset.media = "preview";
    const sheet = el("div", null, "detail-media-item");
    sheet.dataset.media = "image-source";
    const stills = el("div", null, "detail-media-stills");
    const stillStatus = el("div", null, "detail-media-item");
    stillStatus.dataset.media = "still-status";
    rail.append(trailer, sheet, stillStatus, stills);
    root.append(rail);
    /** @type {any} */ let movie;
    /** @type {LifecycleScope | undefined} */ let previewScope;
    /** @type {LifecycleScope | undefined} */ let sheetScope;
    let busy = false;
    let opening = false;
    /** @type {{url:string,thumbnail?:string}[]} */ let sheetImages = [];
    /** @type {string[]} */ let gallery = [];

    const settings = () => services.settings.snapshot();
    const eligible = () => (movie.stateEligibility ?? getMovieStateEligibility(movie)).eligible;
    const masked = () => document.body.hasAttribute("data-jhs-mobile-mask");
    const login = () => app.run(scope, async () => {
        if (await app.login("javdb") && !scope.disposed) await retryDetail(true);
    });
    function loginForTrailer() {
        trailerStatus("原站预告需要登录", "登录 JavDB", login);
    }
    /** @param {string} text @param {string} [action] @param {()=>unknown} [callback] */
    function trailerStatus(text, action, callback) {
        status(trailer, text, action, callback);
        const poster = validHttps(movie.preview?.poster) ?? validHttps(movie.coverUrl);
        if (poster) trailer.prepend(image(poster, "detail-media-poster"));
    }
    /** @param {string} id */
    function child(id) {
        const owner = new LifecycleScope(id);
        const release = scope.addCleanup(() => owner.dispose());
        owner.addCleanup(release);
        return owner;
    }
    /** @param {boolean} [retry] */
    async function loadTrailer(retry = false) {
        previewScope?.dispose();
        trailer.hidden = !canUsePreview(settings());
        if (trailer.hidden) return;
        const owner = previewScope = child("android:detail-trailer");
        trailerStatus("正在查找预告");
        if (busy) return;
        if (!navigator.onLine) { status(trailer, "离线时无法获取预告"); return; }
        const preferences = settings();
        let native = movie.preview;
        /** @type {string|null} */ let dmmUrl = null;
        /** @type {unknown} */ let nativeFailure;
        let dmmFailure = "";
        let shown = false;
        const needsLogin = () => Boolean(native?.requiresLogin ||
            (/** @type {{code?:string}} */ (nativeFailure))?.code === "AUTH_REQUIRED");
        function sources() {
            /** @type {TrailerSource[]} */ const sources = [];
            if (dmmUrl) sources.push({ url: dmmUrl });
            const nativeUrl = validHttps(native?.video);
            if (nativeUrl && nativeUrl !== dmmUrl) sources.push({ url: nativeUrl, hls: native.hls });
            return sources;
        }
        function showPlayable() {
            if (shown || owner.disposed || !sources().length) return;
            shown = true;
            const poster = validHttps(native?.poster) ?? validHttps(movie.coverUrl);
            tile(trailer, "预告", poster, trigger => {
                if (masked() || owner.disposed) return;
                if (services.privacy.enabled) return services.notifications.info("关闭隐私遮罩后可播放预告");
                openTrailer(services.http, availability, poster, trigger, owner, () => void loadTrailer(true), login);
            }, true);
        }
        async function findNative() {
            try {
                const result = await readSessionPreview(movie.id, owner);
                owner.assertActive();
                native = result;
                showPlayable();
            } catch (error) {
                nativeFailure = error;
            }
        }
        async function findDmm() {
            if (!eligible() || !canUseDmmPreview(preferences)) return;
            try {
                if (retry) invalidateDmmPreview(movie.carNum, services.storage);
                const result = await fetchDmmPreviewIfEnabled(movie.carNum, services.storage, services.movie, owner, preferences);
                owner.assertActive();
                const quality = Z(Object.keys(result.sources || {}), preferences.videoQuality);
                const preferred = quality ? validHttps(result.sources?.[quality]) : null;
                if (!preferred) {
                    if (result.error) dmmFailure = "预告加载失败";
                    return;
                }
                const rejected = await isDmmVideoRejected(services.http, preferred, owner);
                owner.assertActive();
                if (rejected) dmmFailure = "DMM 预告暂不可用";
                else { dmmUrl = preferred; showPlayable(); }
            } catch {
                dmmFailure = "预告加载失败";
            }
        }
        const dmm = findDmm();
        const needsNative = movie.id && !validHttps(native?.video);
        const sitePreview = needsNative && native?.deferred ? findNative() : dmm.then(() => {
            if (!owner.disposed && needsNative && !dmmUrl && native?.requiresLogin) return findNative();
        });
        const availability = { sources, needsLogin, ready: Promise.all([dmm, sitePreview]).then(() => undefined) };
        showPlayable();
        await availability.ready;
        if (owner.disposed || shown) return;
        if (needsLogin()) loginForTrailer();
        else if (nativeFailure || dmmFailure) trailerStatus(dmmFailure || "预告加载失败", "重试", () => void loadTrailer(true));
        else status(trailer, "暂无预告");
    }

    /** @param {string} [providerId] @param {boolean} [retry] */
    async function loadSheet(providerId, retry = false) {
        sheetScope?.dispose();
        sheet.hidden = !services.screenshot.isEnabled(settings());
        sheetImages = [];
        renderStills();
        if (sheet.hidden) return;
        const owner = sheetScope = child("android:detail-contact-sheet");
        status(sheet, "正在查找长缩略图");
        if (busy) return;
        if (!navigator.onLine) { status(sheet, "离线时无法获取长缩略图"); return; }
        const preferences = settings();
        if (!eligible()) { status(sheet, "暂无长缩略图"); return; }
        const chooseProvider = () => {
            const options = services.screenshot.getEnabledProviders(preferences);
            if (!options.length) { status(sheet, "暂无可用来源"); return; }
            const input = select([["", "选择来源"], ...options.map((/** @type {any} */ p) => [p.id, p.name])], "长缩略图来源");
            input.value = providerId || "";
            input.onchange = () => { if (input.value) void loadSheet(input.value); };
            sheet.append(input);
        };
        const manual = services.screenshot.getScreenshotSettings(preferences).mode === "manual";
        if (manual && !providerId) { status(sheet, "长缩略图"); chooseProvider(); return; }
        const failed = () => {
            status(sheet, "长缩略图加载失败", "重试", () => void loadSheet(providerId, true));
            if (manual) chooseProvider();
        };
        try {
            const assets = await services.screenshot.resolve(movie, { scope: owner, settings: preferences, providerId, refreshCache: retry });
            owner.assertActive();
            sheetImages = assets || [];
            renderStills();
            sheet.hidden = !manual;
            if (manual) { status(sheet, "长缩略图"); chooseProvider(); }
        } catch {
            if (!owner.disposed) failed();
        }
    }

    function renderStills() {
        const urls = new Map();
        const screenshots = movie.stills ?? movie.images ?? [];
        for (const candidate of screenshots) {
            const url = validHttps(typeof candidate === "string" ? candidate : candidate.url);
            if (url && !urls.has(url)) urls.set(url, validHttps(candidate.thumbnail) ?? url);
        }
        const leading = sheetImages.flatMap(entry => {
            const url = validHttps(entry.url);
            if (!url) return [];
            if (!urls.has(url)) urls.set(url, validHttps(entry.thumbnail) ?? url);
            return [url];
        });
        gallery = [...new Set([...leading, ...urls.keys()])];
        // Retain existing tiles while another source settles so focus and the open viewer survive.
        const existing = new Map([...stills.children].map(node => [node.getAttribute("data-image-url"), node]));
        const tiles = gallery.map(url => {
            const previous = existing.get(url);
            if (previous) return previous;
            const slot = el("div", null, "detail-media-item");
            slot.setAttribute("data-media", "image");
            slot.setAttribute("data-image-url", url);
            /** @param {HTMLButtonElement} trigger */
            const open = trigger => {
                const index = gallery.indexOf(url);
                if (masked() || index < 0 || opening) return;
                if (services.privacy.enabled) return services.notifications.info("关闭隐私遮罩后可查看原图");
                opening = true;
                void app.openGallery({ urls: gallery, initialIndex: index }).then(() => {
                    if (!scope.disposed && !masked() && trigger.isConnected) trigger.focus({ preventScroll: true });
                }).catch(() => {
                    if (!scope.disposed) services.notifications.error("无法打开相册");
                }).finally(() => { opening = false; });
            };
            function renderThumbnail() {
                const trigger = tile(slot, "", urls.get(url) ?? null, open);
                const img = trigger.querySelector("img");
                if (img) scope.listen(img, "error", () => {
                    status(slot, "图片加载失败", "重试", renderThumbnail);
                    const original = button("查看原图", () => open(original));
                    slot.append(original);
                }, { once: true });
            }
            renderThumbnail();
            return slot;
        });
        for (const [index, element] of tiles.entries()) {
            if (stills.children[index] !== element) stills.insertBefore(element, stills.children[index] ?? null);
        }
        while (stills.childElementCount > tiles.length) stills.lastElementChild?.remove();
    }

    scope.listen(services.settings, "settings.changed", event => {
        const names = /** @type {CustomEvent} */ (event).detail?.names ?? [];
        if (!movie) return;
        if (names.some((/** @type {string} */ key) => ["enablePreviewVideo", "enableLoadPreviewVideo", "videoQuality"].includes(key))) void loadTrailer();
        if (names.some((/** @type {string} */ key) => ["enableLoadScreenShot", "screenshotMode", "screenshotProviders"].includes(key))) void loadSheet();
    });
    return {
        /** @param {any} value @param {boolean} pending */
        update(value, pending = false) {
            movie = value;
            busy = pending;
            stillStatus.hidden = Boolean((value.stills ?? value.images)?.length);
            status(stillStatus, pending ? "正在查找截图" : "暂无截图");
            void loadTrailer();
            void loadSheet();
        },
        /** @param {unknown} error */
        loadFailed(error) {
            busy = false;
            const auth = /** @type {{code?:string}} */ (error)?.code === "AUTH_REQUIRED";
            stillStatus.hidden = false;
            status(stillStatus, !navigator.onLine ? "当前离线" : auth ? "原站截图需要登录" : "在线画面暂不可用", auth ? "登录 JavDB" : "重试", () => app.run(scope, async () => {
                if ((!auth || await app.login("javdb")) && !scope.disposed) await retryDetail(auth);
            }));
            void loadTrailer();
            void loadSheet();
        },
    };
}
