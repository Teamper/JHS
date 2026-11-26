// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { parseBooleanSetting } from "../../core/feature-helpers.js";
import { button } from "./components.js";
export { movieTitle } from "./components.js";

const SELECTOR = "[data-movie-title]";

/** @param {HTMLElement} root @param {any} services @param {LifecycleScope} scope */
export function observeMovieTitles(root, { settings, privacy, translation }, scope) {
    /** @type {Map<HTMLElement, {original:string, result:string, attempted:boolean, visible:boolean, originalShown:boolean, call?:LifecycleScope, control?:HTMLButtonElement}>} */
    const entries = new Map();
    const enabled = () => parseBooleanSetting(settings.snapshot().androidTranslateTitle, true);
    const readable = () => enabled() && !privacy.enabled && !document.hidden && !scope.disposed;

    /** @param {HTMLElement} title @param {boolean} [retry] */
    async function update(title, retry = false) {
        const entry = entries.get(title);
        if (!entry) return;
        if (!readable() || !entry.visible) {
            entry.call?.dispose();
            if (!enabled()) {
                title.textContent = entry.original;
                if (entry.control) entry.control.hidden = true;
            }
            return;
        }
        const render = () => {
            title.textContent = entry.result && !entry.originalShown ? entry.result : entry.original;
            if (!entry.control) return;
            entry.control.hidden = !entry.result || entry.result === entry.original;
            entry.control.textContent = entry.originalShown ? "显示译文" : "显示原文";
            entry.control.onclick = () => { entry.originalShown = !entry.originalShown; render(); };
        };
        if (entry.result) { render(); return; }
        if (entry.call || entry.attempted && !retry) return;
        entry.attempted = true;
        if (entry.control) entry.control.hidden = true;
        const call = entry.call = new LifecycleScope("android:title-translation");
        try {
            entry.result = await translation.translate(entry.original, {
                sourceLanguage: "auto", targetLanguage: "zh-CN", scope: call,
                canDispatch: () => readable() && entry.visible && root.contains(title) && navigator.onLine,
            });
            if (!call.disposed && readable() && root.contains(title)) render();
        } catch {
            if (call.disposed) entry.attempted = false;
            else if (entry.control && readable() && navigator.onLine) {
                entry.control.textContent = "重试翻译";
                entry.control.onclick = () => void update(title, true);
                entry.control.hidden = false;
            }
        } finally {
            call.dispose();
            entry.call = undefined;
            if (!entry.attempted && readable() && entry.visible && root.contains(title)) void update(title);
        }
    }

    const visibility = new IntersectionObserver(changes => {
        for (const { target, isIntersecting } of changes) {
            const title = /** @type {HTMLElement} */ (target);
            const entry = entries.get(title);
            if (!entry) continue;
            entry.visible = isIntersecting;
            void update(title);
        }
    });
    scope.ownObserver(visibility);
    /** @param {Node} node @param {(title:HTMLElement)=>void} visit */
    function visitTitles(node, visit) {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(SELECTOR)) visit(node);
        for (const title of node.querySelectorAll(SELECTOR)) visit(/** @type {HTMLElement} */ (title));
    }
    /** @param {HTMLElement} title */
    function register(title) {
        if (entries.has(title) || !root.contains(title)) return;
        const original = title.dataset.movieTitle;
        if (!original) return;
        const detail = title.tagName === "H2";
        const control = detail ? button("", () => {}, "title-translation-action") : undefined;
        if (control) { control.hidden = true; title.after(control); }
        entries.set(title, { original, result: "", attempted: false, visible: false, originalShown: false, control });
        visibility.observe(title);
    }
    scope.observe(root, mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) visitTitles(node, title => {
                if (root.contains(title)) return;
                entries.get(title)?.call?.dispose();
                entries.delete(title);
                visibility.unobserve(title);
            });
            for (const node of mutation.addedNodes) visitTitles(node, register);
        }
    }, { childList: true, subtree: true });
    visitTitles(root, register);
    function refresh() { for (const title of entries.keys()) void update(title, true); }
    scope.listen(settings, "settings.changed", event => {
        if (/** @type {CustomEvent} */ (event).detail?.names?.includes("androidTranslateTitle")) refresh();
    });
    scope.listen(privacy, "privacy.changed", refresh);
    scope.listen(document, "visibilitychange", refresh);
    scope.listen(window, "online", refresh);
    scope.addCleanup(() => { for (const entry of entries.values()) entry.call?.dispose(); entries.clear(); });
}
