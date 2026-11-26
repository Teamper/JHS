// @ts-check

const mobileAgents = /iphone|ipod|ipad|android|blackberry|windows phone|nokia|webos|opera mini|mobile|mobi|tablet/i;

/** @param {Pick<Window, "navigator">} [view] */
export function isMobile(view = window) { return mobileAgents.test(view.navigator.userAgent); }

/** @param {unknown} mode @param {Pick<Window, "navigator" | "innerWidth">} [view] */
export function isMobileMode(mode, view = window) {
    return mode === "on" || mode !== "off" && (isMobile(view) || view.innerWidth < 768);
}

/** @param {boolean} mobile @param {number} width @param {[string, string]} [area] @returns {[string, string]} */
export function getResponsiveArea(mobile, width, area) {
    if (mobile) return ["100%", "90%"];
    return width >= 1200 ? area ?? ["85%", "90%"] : ["70%", "90%"];
}

/** @param {{offsetWidth: number, offsetHeight: number} & Element | {jquery: string, 0?: HTMLElement} | null} target */
export function isHidden(target) {
    const element = target && "jquery" in target ? target[0] : target;
    return !element || element.offsetWidth <= 0 && element.offsetHeight <= 0 || getComputedStyle(element).display === "none";
}

export function smoothScrollToTop(duration = 500, view = window) {
    return new Promise(resolve => {
        const startedAt = performance.now(), startY = view.scrollY;
        /** @param {number} time */
        const frame = time => {
            const progress = duration <= 0 ? 1 : Math.min((time - startedAt) / duration, 1);
            const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
            view.scrollTo(0, startY * (1 - eased));
            if (progress < 1) view.requestAnimationFrame(frame);
            else resolve(undefined);
        };
        view.requestAnimationFrame(frame);
    });
}

/** @param {() => boolean} condition @param {() => void} accept @param {number} [debounceMs] @param {number} [timeout] @param {boolean} [acceptOnTimeout] @param {import("./lifecycle-scope.js").LifecycleScope | null} [scope] @param {{error?: (...parts: unknown[]) => void}} [logger] */
export function waitForDom(condition, accept, debounceMs = 20, timeout = 10000, acceptOnTimeout = true, scope = null, logger = console) {
    /** @type {MutationObserver | undefined} */
    let observer;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let debounceTimer;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutTimer;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    let fallback;
    let done = false;
    const cancel = () => {
        done = true;
        if (observer) scope?.releaseObserver(observer);
        clearTimeout(debounceTimer);
        clearTimeout(timeoutTimer);
        clearInterval(fallback);
    };
    /** @param {boolean} ready */
    const finish = ready => {
        if (done) return;
        cancel();
        if (ready && !scope?.disposed) accept();
    };
    const check = () => { if (!done && !scope?.disposed && condition()) finish(true); };
    if (condition()) { finish(true); return cancel; }
    if (scope?.observe && document.documentElement) {
        observer = scope.observe(document.documentElement, () => {
            if (done) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(check, Math.max(0, debounceMs));
        }, { childList: true, subtree: true, characterData: true });
    } else fallback = setInterval(check, Math.max(100, debounceMs));
    timeoutTimer = setTimeout(() => {
        if (done || scope?.disposed) { cancel(); return; }
        let ready = false;
        try { ready = condition(); } catch (error) { logger.error?.("DOM 等待条件执行失败", error); }
        finish(ready || acceptOnTimeout);
    }, Math.max(0, timeout));
    return scope?.addCleanup ? scope.addCleanup(cancel) : cancel;
}
