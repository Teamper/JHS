// @ts-check

import { normalizeCarNum } from "../../core/constants.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */

/** Keep the workspace context self-contained for legacy VM-loaded fixtures. */
/** @param {unknown} value @param {string} [surface] */
function normalizeWorkspaceMovieContext(value, surface = "other") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = /** @type {Record<string, unknown>} */ (value), carNum = normalizeCarNum(raw.carNum);
    if (!carNum) return null;
    return Object.freeze({ ...raw, carNum, movieId: typeof raw.movieId === "string" && raw.movieId.trim() ? raw.movieId.trim() : raw.movieId ?? null, surface: raw.surface || surface });
}

/** 创建 FC2 自有详情壳，所有异步模块只写入固定插槽。 */
/** @param {{ carNum?: string, movieId?: string|null, url?: string, source?: string, mode?: string }} [options] */
export function createFc2DetailShell({ carNum = "", source = "fc2", mode = "dialog" } = {}) {
    const workspace = $('<div class="jhs-fc2-workspace jhs-ui"></div>').attr({
        "data-jhs-fc2-source": source,
        "data-jhs-fc2-mode": mode,
        "data-jhs-car-num": normalizeCarNum(carNum) || ""
    });
    const definitions = [ [ "summary", "影片概览" ], [ "gallery", "预览与剧照" ], [ "resources", "资源" ], [ "reviews", "评论" ], [ "related", "相关清单" ] ];
    definitions.forEach((([ name, title ]) => {
        const section = $('<section class="jhs-fc2-section"></section>').attr("data-jhs-section", name);
        const header = $('<header class="jhs-fc2-section__header"></header>'), heading = $("<h2></h2>").text(title), actions = $('<div class="jhs-fc2-section__actions"></div>').attr("data-jhs-section-actions", name);
        section.append(header.append(heading, actions), $('<div class="jhs-fc2-section__content"></div>').attr("data-jhs-slot", name)), workspace.append(section);
    }));
    return workspace;
}

/** 创建只属于单个 FC2 详情实例的生命周期和插槽上下文。 */
/** @param {JQueryHandle | Element} root @param {Record<string, unknown>} [options] */
export function createFc2DetailContext(root, options = {}) {
    const workspace = $(root).is(".jhs-fc2-workspace") ? $(root) : $(root).find(".jhs-fc2-workspace").first();
    let destroyed = !1;
    const namespace = `.jhsFc2Detail${Date.now()}${Math.random().toString(36).slice(2)}`, observers = new Set();
    const surface = options.mode === "dialog" ? "fc2-dialog" : "native-detail";
    const movieContext = normalizeWorkspaceMovieContext({ ...options, carNum: options.carNum || workspace.attr("data-jhs-car-num"), detailUrl: options.url, surface }, surface);
    const context = {
        ...options,
        movieContext,
        root: workspace,
        workspace,
        namespace,
        observers,
        getSlot: (/** @type {string} */ name) => workspace.find(`[data-jhs-slot="${name}"]`).first(),
        getSection: (/** @type {string} */ name) => workspace.find(`[data-jhs-section="${name}"]`).first(),
        isAlive: () => !destroyed && workspace[0]?.isConnected !== !1,
        addObserver(/** @type {{ disconnect?: () => void }} */ observer) { observer && observers.add(observer); return observer; },
        destroy() {
            if (destroyed) return;
            destroyed = !0, workspace.off(namespace).find("*").off(namespace), observers.forEach((observer => observer.disconnect?.())), observers.clear(), workspace.removeData("jhsFc2Context");
        }
    };
    workspace.data("jhsFc2Context", context).attr("data-jhs-surface", surface);
    movieContext && workspace.data("jhsMovieContext", movieContext);
    return context;
}
