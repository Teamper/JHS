// @ts-check
import { mountEnhancementAction } from "./enhancement-actions.js";
import { normalizeCarNum } from "../../core/constants.js";
import { assertMovieStateEligible } from "../../core/movie-identity.js";

/** @param {{host: Element, scope: import("../../core/lifecycle-scope.js").LifecycleScope, getRecord: () => any, state: any, events: Pick<import("../../core/event-bus.js").JhsEventBus, "on">, dialog: any, report: (error: unknown) => void}} options */
export function mountMovieRemark({ host, scope, getRecord, state, events, dialog, report }) {
    const document = host.ownerDocument;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jhs-btn jhs-btn--ghost";
    button.textContent = "编辑备注";
    mountEnhancementAction(host, button, scope);
    const hint = document.createElement("span");
    hint.className = "jhs-badge jhs-badge--neutral";
    hint.setAttribute("data-jhs-privacy-kind", "title");
    hint.hidden = true;
    mountEnhancementAction(host, hint, scope, true);
    let loading = false;
    /** @type {number | null} */ let layer = null;
    scope.addCleanup(() => { if (layer !== null) dialog.close(layer); });
    const render = (/** @type {string} */ remark) => {
        hint.textContent = remark;
        hint.hidden = !remark;
    };
    const carNum = normalizeCarNum(getRecord().carNum);
    let refreshRevision = 0;
    const refresh = async () => {
        const revision = ++refreshRevision;
        try {
            const current = await state.getState(carNum);
            if (!scope.disposed && revision === refreshRevision) render(current?.remark ?? "");
        } catch (error) { if (!scope.disposed) report(error); }
    };
    scope.addCleanup(events.on("car-state-changed", (/** @type {{scope?: string, carNums?: string[]}} */ change) => {
        if (!scope.disposed && (change.scope === "all" || (carNum && change.carNums?.includes(carNum)))) void refresh();
    }));
    void refresh();
    scope.listen(button, "click", async () => {
        if (loading || layer !== null) return;
        loading = true;
        try {
            const target = getRecord();
            assertMovieStateEligible(target);
            const before = (await state.getState(target.carNum))?.remark || "";
            if (scope.disposed) return;
            /** @type {HTMLTextAreaElement} */ let field;
            let saving = false;
            layer = dialog.open({
                type: 1, title: "作品备注", ui: { size: "sm", body: "scroll" },
                content: '<div class="jhs-form-dialog"><textarea class="jhs-textarea" aria-label="作品备注"></textarea></div>',
                btn: ["保存", "取消"],
                success: (/** @type {{0: HTMLElement}} */ root) => {
                    field = /** @type {HTMLTextAreaElement} */ (root[0].querySelector("textarea"));
                    field.value = before;
                },
                end: () => { layer = null; },
                yes: async (/** @type {number} */ id) => {
                    if (scope.disposed || saving) return false;
                    saving = true;
                    try {
                        const remark = field.value.trim();
                        if (remark !== before) {
                            const metadata = Object.fromEntries(Object.entries(target).filter(([, value]) =>
                                value != null && (typeof value !== "string" || value.trim())));
                            await state.patch(target.carNum, {}, { type: "detail-remark", record: { ...metadata, remark }, replaceMetadata: true });
                        }
                        if (layer === id && !scope.disposed) dialog.close(id);
                    } catch (error) { if (layer === id && !scope.disposed) report(error); }
                    finally { saving = false; }
                    return false;
                },
            });
        } catch (error) { if (!scope.disposed) report(error); }
        finally { loading = false; }
    });
}
