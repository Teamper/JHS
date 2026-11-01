import { JhsSelect } from "../../core/ui-primitives.js";
// @ts-check

/** In-memory ownership for the full form; it never persists settings or credentials. */
export class SettingsDraft {
    /** @param {any} root @param {Record<string, string>} selectors */
    constructor(root, selectors) {
        this.root = root;
        this.selectors = selectors;
        this.disposed = false;
        this.submitting = new Set();
        this.baseline = this.capture();
        /** @type {Map<Element, string>} */ this.pendingBaseline = new Map();
        this.pendingFields().each((/** @type {number} */ _, /** @type {HTMLInputElement} */ element) => this.pendingBaseline.set(element, String(root.find(element).val() || "")));
        root.off(".jhsDraft").on("input.jhsDraft change.jhsDraft", () => this.refresh());
        this.session = root.data("jhsFullSettingsSession");
        this.onSessionChanged = () => {
            const applied = this.session.settings.snapshot();
            for (const [key, selector] of Object.entries(this.selectors)) {
                if (this.submitting.has(key) || key === "webDavPassword" || !Object.hasOwn(applied, key)) continue;
                if (this.value(selector) !== this.baseline.fields[key]) continue;
                const field = root.find(selector);
                if (field.is('[type="checkbox"]')) field.prop("checked", applied[key] === true || applied[key] === "yes");
                else field.val(key === "circuitBreakerCooldown" ? Number(applied[key]) / 1000 : String(applied[key] ?? ""));
                if (field.is("select")) JhsSelect.refresh(field);
                this.baseline.fields[key] = this.value(selector);
            }
            this.refresh();
        };
        this.session?.addEventListener("settings.changed", this.onSessionChanged);
        if (this.session) this.onSessionChanged(); else this.refresh();
    }
    pendingFields() { return this.root.find(".keyword-input,#advanced-resource-json,#car-number-import,#car-number-import-status"); }
    /** @param {string} selector */
    value(selector) {
        const field = this.root.find(selector);
        if (!field.length) return undefined;
        if (field.is('[type="checkbox"]')) return Boolean(field.prop("checked"));
        const value = field.val();
        return String(value ?? "");
    }
    /** @param {string} selector */
    keywords(selector) {
        return [...new Set(this.root.find(`${selector} .keyword-label`).toArray().map((/** @type {Element} */ element) => String(element.getAttribute("data-keyword") ?? element.textContent ?? "").trim()).filter(Boolean))];
    }
    capture() {
        return {
            fields: Object.fromEntries(Object.entries(this.selectors).map(([key, selector]) => [key, this.value(selector)])),
            review: this.keywords("#reviewKeywordContainer"), title: this.keywords("#filterKeywordContainer"),
        };
    }
    beginSubmission() { this.submitting = new Set(this.root.data("jhsDirtyManualKeys") || []); return this.capture(); }
    release() { this.submitting.clear(); }
    refresh() {
        if (this.disposed) return { count: 0, pending: false };
        const current = this.capture();
        const dirty = new Set(Object.keys(current.fields).filter(key => JSON.stringify(current.fields[key]) !== JSON.stringify(this.baseline.fields[key])));
        const review = JSON.stringify(current.review) !== JSON.stringify(this.baseline.review), title = JSON.stringify(current.title) !== JSON.stringify(this.baseline.title);
        this.root.data("jhsDirtyManualKeys", dirty).data("jhsDirtyReviewKeywords", review).data("jhsDirtyTitleKeywords", title);
        let pending = false;
        const pendingGroups = new Set();
        this.pendingFields().each((/** @type {number} */ _, /** @type {HTMLInputElement} */ element) => {
            if (element.readOnly) return;
            if (element.id === "car-number-import-status" && !String(this.root.find("#car-number-import").val() || "").trim()) return;
            const value = String(this.root.find(element).val() || "");
            if ((element.id === "advanced-resource-json" || value.trim()) && value !== (this.pendingBaseline.get(element) || "")) {
                pending = true;
                if (element.matches(".keyword-input")) pendingGroups.add(element.closest("#reviewKeywordContainer") ? "review" : "title");
                if (element.id === "advanced-resource-json") pendingGroups.add("resources");
            }
        });
        this.root.data("jhsDirtyResourceJson", pendingGroups.has("resources"));
        const count = new Set([...dirty, ...(this.session?.dirtyKeys() || [])]).size + Number(review || pendingGroups.has("review")) + Number(title || pendingGroups.has("title")) + Number(pendingGroups.has("resources"));
        const text = count ? `有 ${count} 项未保存` : "";
        this.root.find("#settings-draft-status").text(text);
        this.root.find("#saveBtn").attr("data-jhs-dirty-count", count);
        return { count, pending };
    }
    /** Advance only committed parts of the captured submission; newer edits remain dirty. @param {ReturnType<SettingsDraft['capture']>} submitted @param {string[]} keys */
    commitFields(submitted, keys) {
        if (this.disposed) return;
        for (const key of keys) { this.baseline.fields[key] = submitted.fields[key]; this.submitting.delete(key); }
        this.refresh();
    }
    /** @param {ReturnType<SettingsDraft['capture']>} submitted @param {'review'|'title'} group */
    commitKeywords(submitted, group) { if (this.disposed) return; this.baseline[group] = submitted[group]; this.refresh(); }
    /** @param {string} selector @param {string} value */
    commitPending(selector, value) {
        if (this.disposed) return;
        this.root.find(selector).each((/** @type {number} */ _, /** @type {HTMLInputElement} */ element) => this.pendingBaseline.set(element, value)); this.refresh();
    }
    dispose() {
        this.session?.removeEventListener("settings.changed", this.onSessionChanged);
        this.disposed = true; this.root.off(".jhsDraft"); this.pendingBaseline.clear();
        this.baseline = { fields: {}, review: [], title: [] };
    }
}
