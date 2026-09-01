// @ts-check

import { JhsSelect } from "../../core/ui-primitives.js";

export const DETAIL_WORKSPACE_CSS = `<style>
    .jhs-detail-host-workspace { color:var(--jhs-text); }
    .jhs-detail-host-workspace .jhs-detail-btn-row { margin:0!important; }
    .jhs-detail-owned-slot { min-width:0; padding:var(--jhs-space-5) 0; border-top:1px solid var(--jhs-border); }
    .jhs-detail-owned-slot:empty { display:none; }
    .jhs-detail-owned-slot--summary-actions { padding:var(--jhs-space-3) 0 var(--jhs-space-5); border-top:0; }
    .jhs-detail-post-resource { min-width:0; }
    .jhs-detail-host-action { display:inline-flex!important; min-height:var(--jhs-control-height)!important; align-items:center!important; justify-content:center!important; padding:0 var(--jhs-space-3)!important; border:1px solid var(--jhs-border)!important; border-radius:var(--jhs-radius-sm)!important; background:var(--jhs-surface)!important; color:var(--jhs-text)!important; box-shadow:none!important; font:inherit!important; font-size:var(--jhs-font-size-sm)!important; font-weight:600!important; line-height:1!important; text-decoration:none!important; }
    .jhs-detail-host-action:hover { border-color:var(--jhs-accent)!important; background:var(--jhs-surface-2)!important; color:var(--jhs-accent)!important; }
    .jhs-offline-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-2); margin-left:var(--jhs-space-2); vertical-align:middle; }
    @media (max-width:767px) { .jhs-detail-owned-slot { padding:var(--jhs-space-4) 0; } }
</style>`;

/** Own stable detail slots and the host resource lifecycle. */
export class DetailWorkspaceController {
    /** @param {{hostAdapter: any, styles?: any, eventBus?: any, ui?: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.styles = options.styles ?? null;
        this.eventBus = options.eventBus ?? null;
        this.ui = options.ui ?? null;
        this.scope = options.scope;
        /** @type {Element | null} */ this.root = null;
        /** @type {(() => void) | null} */ this.styleRelease = null;
        /** @type {any} */ this.resourceObserver = null;
        /** @type {number | null} */ this.scheduledResourceFrame = null;
        /** @type {(() => void) | null} */ this.cancelScheduledResourceFrame = null;
        /** @type {Set<Element>} */ this.createdSlots = new Set();
        /** @type {Array<{element: Element, parent: Node, nextSibling: Node | null}>} */ this.adoptedPanels = [];
        /** @type {Map<Element, Map<string, string | null>>} */ this.previousAttributes = new Map();
        /** @type {Map<Element, Map<string, boolean>>} */ this.addedClasses = new Map();
        /** @type {Map<HTMLElement, boolean>} */ this.normalizedActions = new Map();
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
        this.scope.addCleanup(() => this.cancelScheduledResourceFrame?.());
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || !this.hostAdapter || !this.hostAdapter.location || !this.hostAdapter.locateDetailRoot) return;
        const root = this.hostAdapter.locateDetailRoot();
        if (!root) return;
        this.started = true;
        this.root = root;
        this.styleRelease = this.styles?.register?.("jhs-detail-workspace", DETAIL_WORKSPACE_CSS.replace(/^\s*<style>|<\/style>\s*$/g, "")) ?? null;
        this.markHostRegions(root);
        this.ensureOwnedSlots(root);
        this.adoptExistingOwnedPanels(root);
        this.placeOwnedSlots();
        this.bindResourceLifecycle();
    }

    /** @param {Element} root */
    markHostRegions(root) {
        this.setAttribute(root, "data-jhs-workspace-ready", "true");
        this.setAttribute(root, "data-jhs-workspace-site", this.hostAdapter.site || "unknown");
        this.addClass(root, "jhs-detail-host-workspace");
        this.addClass(root, "jhs-ui");
        if (this.hostAdapter.site === "javdb") {
            root.querySelectorAll(":scope > h2, :scope > .video-meta-panel").forEach((element) => this.setAttribute(element, "data-jhs-host-region", "summary"));
            root.querySelectorAll(":scope > .columns").forEach((element) => {
                if (element.querySelector(".tile-images, .preview-images")) this.setAttribute(element, "data-jhs-host-region", "gallery");
                if (element.querySelector("#magnets-content")) this.setAttribute(element, "data-jhs-host-region", "resources");
            });
            this.normalizeHostActions(root.querySelector(".video-meta-panel"));
        } else {
            root.querySelectorAll(":scope > h3, :scope > .row.movie").forEach((element) => this.setAttribute(element, "data-jhs-host-region", "summary"));
            const resource = this.hostAdapter.getDetailResourceBoundary?.();
            resource?.resourceRegion && this.setAttribute(resource.resourceRegion, "data-jhs-host-region", "resources");
            root.querySelectorAll(":scope > *").forEach((element) => {
                if (element.matches("#sample-waterfall") || element.querySelector("#sample-waterfall")) this.setAttribute(element, "data-jhs-host-region", "gallery");
            });
            this.normalizeHostActions(root.querySelector(".info"));
        }
    }

    /** @param {Element | null} element @param {string} name @param {string} value */
    setAttribute(element, name, value) {
        if (!element) return;
        let attributes = this.previousAttributes.get(element);
        if (!attributes) this.previousAttributes.set(element, attributes = new Map());
        if (!attributes.has(name)) attributes.set(name, element.getAttribute(name));
        element.setAttribute(name, value);
    }

    /** @param {Element} element @param {string} className */
    addClass(element, className) {
        let classes = this.addedClasses.get(element);
        if (!classes) this.addedClasses.set(element, classes = new Map());
        if (!classes.has(className)) classes.set(className, element.classList.contains(className));
        element.classList.add(className);
    }

    /** @param {Element} root */
    ensureOwnedSlots(root) {
        let summary = root.querySelector(':scope > [data-jhs-slot="summary-actions"]');
        if (!summary) {
            summary = root.ownerDocument.createElement("div");
            summary.className = "jhs-detail-owned-slot jhs-detail-owned-slot--summary-actions";
            summary.setAttribute("data-jhs-slot", "summary-actions");
            root.append(summary);
            this.createdSlots.add(summary);
        }
        let group = root.querySelector(':scope > [data-jhs-slot-group="post-resource"]');
        if (!group) {
            group = root.ownerDocument.createElement("div");
            group.className = "jhs-detail-post-resource";
            group.setAttribute("data-jhs-slot-group", "post-resource");
            root.append(group);
            this.createdSlots.add(group);
        }
        for (const name of ["reviews", "related"]) {
            if (group.querySelector(`:scope > [data-jhs-slot="${name}"]`)) continue;
            const slot = root.ownerDocument.createElement("section");
            slot.className = `jhs-detail-owned-slot jhs-detail-owned-slot--${name}`;
            slot.setAttribute("data-jhs-slot", name);
            group.append(slot);
            this.createdSlots.add(slot);
        }
    }

    /** @param {Element} root */
    adoptExistingOwnedPanels(root) {
        for (const [selector, slotName] of [[".jhs-detail-btn-row", "summary-actions"], [".jhs-related-panel", "related"], [".jhs-review-panel", "reviews"]]) {
            const target = root.querySelector(`[data-jhs-slot="${slotName}"]`);
            if (!target) continue;
            root.querySelectorAll(selector).forEach((element) => {
                if (element.closest("[data-jhs-slot]")) return;
                const parent = element.parentNode;
                if (!parent) return;
                this.adoptedPanels.push({ element, parent, nextSibling: element.nextSibling });
                target.append(element);
            });
        }
    }

    /** @param {Element | null} info */
    normalizeHostActions(info) {
        if (!info) return;
        const labels = new Set(["想看", "看过", "看過", "存入清单", "存入清單", "下载", "下載", "订正", "訂正"]);
        info.querySelectorAll("a, button").forEach((/** @type {Element} */ element) => {
            if (element.matches(".jhs-btn, [id^='jhs-']") || !labels.has((element.textContent || "").replace(/\s+/g, " ").trim())) return;
            const action = /** @type {HTMLElement} */ (element);
            this.normalizedActions.set(action, action.classList.contains("jhs-detail-host-action"));
            action.classList.add("jhs-detail-host-action");
        });
    }

    getResourceBoundary() { return this.hostAdapter.getDetailResourceBoundary?.() ?? null; }

    placeOwnedSlots() {
        const root = this.root;
        if (!root) return;
        this.ensureOwnedSlots(root);
        const summaryActions = root.querySelector(':scope > [data-jhs-slot="summary-actions"]');
        const postResource = root.querySelector(':scope > [data-jhs-slot-group="post-resource"]');
        const summaryRegion = this.hostAdapter.site === "javdb" ? root.querySelector(":scope > .video-meta-panel") : root.querySelector(":scope > .row.movie");
        if (summaryRegion && summaryActions) summaryRegion.after(summaryActions);
        const resource = this.getResourceBoundary();
        const resourceRegion = resource?.resourceRegion;
        if (resourceRegion && postResource) resourceRegion.after(postResource);
    }

    bindResourceLifecycle() {
        const resource = this.getResourceBoundary();
        if (!resource?.observeRoot) return;
        if (this.resourceObserver?.root === resource.observeRoot) return void this.scheduleResourceUpdate();
        this.resourceObserver && this.scope.releaseObserver(this.resourceObserver);
        this.resourceObserver = this.scope.observe(resource.observeRoot, (/** @type {MutationRecord[]} */ records) => {
            records.every((record) => this.isJhsOnlyMutation(record)) || this.scheduleResourceUpdate();
        }, { childList: true, subtree: true });
        this.resourceObserver.root = resource.observeRoot;
        if (resource.sortSelect) {
            resource.sortSelect.classList.add("jhs-select-source");
            try { JhsSelect.enhance(resource.controller); } catch {}
        }
        this.scheduleResourceUpdate();
    }

    /** @param {MutationRecord} record */
    isJhsOnlyMutation(record) {
        if (record.target instanceof Element && record.target.closest(".jhs-offline-actions,.jhs-select-control,.jhs-magnet-score")) return true;
        const nodes = [...record.addedNodes, ...record.removedNodes].filter((node) => node.nodeType === Node.ELEMENT_NODE);
        return nodes.length > 0 && nodes.every((node) => {
            const element = /** @type {Element} */ (node);
            return element.matches?.(".jhs-offline-btn,.jhs-offline-actions,.jhs-magnet-score,.jhs-select-control") || element.closest?.(".jhs-offline-actions,.jhs-select-control");
        });
    }

    scheduleResourceUpdate() {
        if (this.scheduledResourceFrame !== null) return;
        const runtimeWindow = this.hostAdapter.document?.defaultView ?? globalThis.window;
        const usesAnimationFrame = typeof runtimeWindow?.requestAnimationFrame === "function";
        const update = () => {
            this.scheduledResourceFrame = null;
            this.cancelScheduledResourceFrame = null;
            if (this.disposed) return;
            const resource = this.getResourceBoundary();
            if (!resource) return;
            this.placeOwnedSlots();
            if (resource.sortSelect) {
                resource.sortSelect.classList.add("jhs-select-source");
                try { JhsSelect.enhance(resource.controller); JhsSelect.refresh(resource.sortSelect); } catch {}
            }
            void this.eventBus?.emit?.("magnet-items-updated", { site: resource.site, resourceRoot: resource.resourceRoot, rows: resource.rows() }, { broadcast: false });
        };
        this.scheduledResourceFrame = usesAnimationFrame ? runtimeWindow.requestAnimationFrame(update) : Number(setTimeout(update));
        this.cancelScheduledResourceFrame = () => {
            if (this.scheduledResourceFrame === null) return;
            usesAnimationFrame ? runtimeWindow.cancelAnimationFrame?.(this.scheduledResourceFrame) : clearTimeout(this.scheduledResourceFrame);
        };
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.cancelScheduledResourceFrame?.();
        this.scheduledResourceFrame = null;
        this.resourceObserver && this.scope.releaseObserver(this.resourceObserver);
        this.resourceObserver = null;
        for (const [element, wasPresent] of this.normalizedActions) {
            if (!wasPresent) element.classList.remove("jhs-detail-host-action");
        }
        for (const [element, attributes] of this.previousAttributes) {
            for (const [name, previous] of attributes) previous === null ? element.removeAttribute(name) : element.setAttribute(name, previous);
        }
        for (const [element, classes] of this.addedClasses) {
            for (const [name, wasPresent] of classes) if (!wasPresent) element.classList.remove(name);
        }
        for (const { element, parent, nextSibling } of this.adoptedPanels) parent.insertBefore(element, nextSibling);
        for (const slot of this.createdSlots) slot.remove();
        this.styleRelease?.();
        this.styleRelease = null;
        this.adoptedPanels = [];
        this.createdSlots.clear();
        this.previousAttributes.clear();
        this.addedClasses.clear();
        this.normalizedActions.clear();
        this.root = null;
    }
}
