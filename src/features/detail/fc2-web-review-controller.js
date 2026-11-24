// @ts-check

/** @typedef {import("../../services/javdb-web-review-service.js").ReviewView} ReviewView */
/** @typedef {import("../../integrations/javdb/web-review.js").ReviewAction} ReviewAction */

/** @param {{root: HTMLElement, movie: import("../../integrations/javdb/web-review.js").ReviewMovie, service: import("../../services/javdb-web-review-service.js").JavDbWebReviewService, scope: import("../../core/lifecycle-scope.js").LifecycleScope, dialog: import("../../services/dialog-service.js").DialogService, ui: import("../../services/dom-ui-service.js").DomUiService, notifications: any}} options */
export function mountFc2WebReview({ root, movie, service, scope, dialog, ui, notifications }) {
    const doc = root.ownerDocument;
    const win = /** @type {Window} */ (doc.defaultView);
    /** @param {string} label @param {string} action */
    const button = (label, action) => {
        const element = doc.createElement("button");
        element.type = "button";
        element.className = "jhs-btn jhs-btn--secondary";
        element.textContent = label;
        element.dataset.jhsAction = action;
        return element;
    };
    const want = button("JavDB 想看", "javdb-want");
    const watched = button("JavDB 看过", "javdb-watched");
    const refresh = button("读取 JavDB 状态…", "javdb-review-refresh");
    const login = doc.createElement("a");
    login.className = "jhs-btn jhs-btn--secondary";
    login.textContent = "登录 JavDB 网页";
    login.href = new URL("/login", win.location.origin).href;
    login.target = "_blank";
    login.rel = "noopener noreferrer";
    /** @type {ReviewView | null} */
    let state = null;
    /** @type {number | null} */
    let childDialog = null;
    let loading = false, submitting = false, pending = false;

    scope.addCleanup(() => { if (childDialog !== null) dialog.close(childDialog); });

    function renderActions() {
        if (!state) return;
        const wanted = state.status === "want_watch", hasWatched = state.status === "watched";
        want.textContent = wanted ? "JavDB 已想看" : "JavDB 想看";
        want.setAttribute("aria-pressed", String(wanted));
        want.disabled = submitting || !state.actions.includes("want");
        watched.textContent = hasWatched ? "JavDB 已看过" : "JavDB 看过";
        watched.setAttribute("aria-pressed", String(hasWatched));
        watched.title = hasWatched ? "取消 JavDB 看过" : "标记 JavDB 看过";
        watched.disabled = submitting || !state.actions.includes(hasWatched ? "unwatch" : "watch");
        if (root.firstChild !== want) root.replaceChildren(want, watched);
    }

    /** @param {string} message */
    function renderRefresh(message) {
        refresh.textContent = message;
        refresh.disabled = loading;
        root.replaceChildren(refresh);
    }

    /** @param {unknown} error */
    function renderError(error) {
        state = null;
        if (/** @type {{code?: string}} */ (error)?.code === "AUTH_REQUIRED") root.replaceChildren(login);
        else renderRefresh("JavDB 状态读取失败，重试");
    }

    async function read() {
        if (scope.disposed || loading || submitting || childDialog !== null) return;
        pending = false;
        loading = true;
        if (!state) renderRefresh("读取 JavDB 状态…");
        try {
            const current = await service.read(movie, { scope });
            if (scope.disposed) return;
            state = current;
            renderActions();
        } catch (error) {
            if (!scope.disposed) { loading = false; renderError(error); }
        } finally { loading = false; }
    }

    /** @param {ReviewAction} action @param {ReviewView} expected @param {number} [score] */
    async function submit(action, expected, score) {
        if (scope.disposed || submitting || loading || state !== expected) return;
        submitting = true;
        renderActions();
        try {
            const result = await service.update(movie, { action, expected, score }, { scope });
            if (scope.disposed) return;
            if (result.outcome === "pending") {
                state = null;
                pending = true;
                renderRefresh("JavDB 待确认，刷新状态");
                return;
            }
            state = result.state ?? null;
            if (result.outcome === "changed") notifications.info("JavDB 网页账号或观影状态已变化，请核对后操作");
            if (result.outcome === "rejected") notifications.error("JavDB 未接受这次操作");
        } catch (error) {
            if (!scope.disposed) renderError(error);
        } finally {
            submitting = false;
            if (!scope.disposed) renderActions();
        }
    }

    /** @param {ReviewView} expected */
    function confirmUnwatch(expected) {
        const effects = [expected.score === null ? "" : "评分（" + expected.score + " 分）", expected.hasComment ? "短评" : ""].filter(Boolean);
        const message = effects.length ? "取消 JavDB 看过会删除这条评价中的" + effects.join("和") + "。" : "取消 JavDB 看过？";
        childDialog = dialog.confirm(message, { tone: "danger", confirmText: "取消看过", end: () => { childDialog = null; } }, id => {
            dialog.close(id);
            void submit("unwatch", expected);
        });
    }

    /** @param {ReviewView} expected */
    function chooseScore(expected) {
        const content = '<label class="jhs-form-field"><span class="jhs-form-label">评分</span><select class="jhs-field jhs-select-source" required>'
            + '<option value="">请选择评分</option><option value="1">1 分</option><option value="2">2 分</option>'
            + '<option value="3">3 分</option><option value="4">4 分</option><option value="5">5 分</option></select></label>';
        childDialog = dialog.open({
            type: 1, title: "标记 JavDB 看过", content, skin: "jhs-confirm-actions",
            ui: { size: "sm", body: "scroll" }, btn: ["取消", "标记看过"],
            end: () => { childDialog = null; },
            btn2: (/** @type {number} */ id, /** @type {Element} */ layer) => {
                const fields = ui.jquery(layer);
                const score = Number(fields.find("select").val());
                if (!score) {
                    notifications.error("请选择评分");
                    fields.find('[role="combobox"]').trigger("focus");
                    return false;
                }
                dialog.close(id);
                void submit("watch", expected, score);
                return false;
            },
        });
    }

    scope.listen(want, "click", () => { if (state?.actions.includes("want") && childDialog === null) void submit("want", state); });
    scope.listen(watched, "click", () => {
        if (!state || loading || submitting || childDialog !== null) return;
        if (state.status === "watched") confirmUnwatch(state);
        else if (state.scoreRequired && state.score === null) chooseScore(state);
        else void submit("watch", state);
    });
    scope.listen(refresh, "click", () => { void read(); });
    scope.listen(win, "focus", () => { if (!pending) void read(); });
    void read();
}
