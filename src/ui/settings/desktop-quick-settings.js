// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { closeOwnedPopover, ownedPopoverRoots } from "../../core/owned-popover.js";

/** Keep a hover form and its portalled controls inside one logical interaction region. */
export class DesktopQuickSettings {
    /** @param {{box:HTMLElement,host:HTMLElement,jquery:any,scope:LifecycleScope,initialize:()=>Promise<void>,onError:(error:unknown)=>void,onOpen:()=>void,canOpen?:()=>boolean}} options */
    constructor(options) {
        this.options = options;
        this.box = options.box;
        this.host = options.host;
        this.scope = new LifecycleScope("desktop-quick-settings");
        this.releaseOwner = options.scope.addCleanup(() => this.scope.dispose());
        this.opened = false;
        this.pointerInside = false;
        this.dismissed = false;
        /** @type {ReturnType<typeof setTimeout> | null} */ this.timer = null;
        /** @type {Promise<void> | null} */ this.loading = null;
        this.ready = false;
        this.generation = 0;
        const doc = this.box.ownerDocument;
        options.jquery(this.box).on("mouseenter.jhsQuickHover", () => { this.pointerInside = true; this.dismissed = false; void this.open(); })
            .on("mouseleave.jhsQuickHover", () => { this.pointerInside = false; this.scheduleClose(); });
        this.scope.listen(doc, "pointermove", event => {
            this.pointerInside = this.contains(/** @type {Node} */ (event.target));
            if (this.pointerInside) {
                this.cancelClose();
                if (!this.opened && !this.dismissed) void this.open();
            } else { this.dismissed = false; if (this.opened) this.scheduleClose(); }
        }, true);
        if (doc.defaultView) this.scope.listen(doc.defaultView, "resize", () => { if (this.opened) this.position(); });
        this.scope.listen(doc, "focusin", event => {
            if (this.contains(/** @type {Node} */ (event.target))) {
                this.cancelClose();
                if (!this.opened && event.target !== this.box.querySelector("button")) void this.open();
            } else this.scheduleClose();
        }, true);
        this.scope.listen(doc, "focusout", () => this.scheduleClose(), true);
        this.scope.listen(doc, "pointerdown", event => {
            if (this.opened && !this.contains(/** @type {Node} */ (event.target))) this.close();
        }, true);
        this.scope.listen(doc, "visibilitychange", () => { if (doc.hidden) { this.pointerInside = false; this.close(); } });
        this.scope.listen(doc, "keydown", event => {
            const key = /** @type {KeyboardEvent} */ (event);
            if (!this.opened || key.key !== "Escape" || ownedPopoverRoots(this.host).length) return;
            key.preventDefault(); this.dismissed = true; this.close(); this.box.querySelector("button")?.focus();
        });
        this.scope.listen(this.box, "keydown", event => {
            const key = /** @type {KeyboardEvent} */ (event);
            if (key.key === "ArrowDown" && event.target === this.box.querySelector("button")) {
                key.preventDefault();
                void this.open().then(() => { if (this.opened) this.host.querySelector(/** @type {"button"} */ ("input,button"))?.focus(); });
            }
        });
        this.scope.addCleanup(() => {
            this.releaseOwner?.(); this.close(); options.jquery(this.box).off(".jhsQuickHover");
            options.jquery(this.host).data("jhsQuickSettingBinding")?.dispose?.();
            options.jquery(this.host).removeData("jhsQuickSettingBinding").empty();
        });
    }
    /** @param {Node | null} target */
    contains(target) {
        return !!target && (this.box.contains(target) || ownedPopoverRoots(this.host).some(root => root.contains(target)));
    }
    cancelClose() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
    scheduleClose() {
        if (this.pointerInside || this.contains(this.box.ownerDocument.activeElement)) {
            this.cancelClose();
            return;
        }
        if (!this.opened || this.timer !== null) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            if (!this.pointerInside && !this.contains(this.box.ownerDocument.activeElement)) this.close();
        }, 200);
    }
    async open() {
        if (this.scope.disposed || !this.box.isConnected || this.options.canOpen?.() === false) return;
        this.cancelClose();
        if (this.ready && !this.host.childElementCount) { this.ready = false; this.loading = null; }
        if (!this.opened) { this.options.onOpen(); closeOwnedPopover(this.box.ownerDocument); }
        this.opened = true;
        const generation = ++this.generation;
        if (!this.ready) {
            if (!this.loading) {
                if (!this.host.childElementCount) this.host.textContent = "加载中…";
                this.options.jquery(this.host).show(); this.position();
            }
            this.loading ??= (async () => { await this.options.initialize(); this.ready = true; })().catch(error => {
                this.options.onError(error); this.loading = null;
                if (this.scope.disposed || !this.box.isConnected || !this.opened) return;
                const retry = this.box.ownerDocument.createElement("button");
                retry.type = "button"; retry.className = "jhs-btn jhs-btn--secondary"; retry.textContent = "加载失败，重试";
                retry.onclick = () => { void this.open(); };
                this.host.replaceChildren(retry); this.options.jquery(this.host).show(); this.position();
            });
            await this.loading;
        }
        if (this.ready && this.opened && generation === this.generation && !this.scope.disposed && this.box.isConnected) { this.options.jquery(this.host).show(); this.position(); }
        else if (!this.opened || this.scope.disposed) this.options.jquery(this.host).hide();
    }
    position() {
        const view = this.box.ownerDocument.defaultView;
        if (!view || !this.opened) return;
        this.host.style.transform = "";
        this.host.style.maxHeight = "";
        const rect = this.host.getBoundingClientRect();
        const width = this.box.ownerDocument.documentElement.clientWidth || view.innerWidth;
        const shift = rect.left < 8 ? 8 - rect.left : Math.min(0, width - 8 - rect.right);
        if (shift) this.host.style.transform = `translateX(${shift}px)`;
        const maximum = parseFloat(view.getComputedStyle(this.host).maxHeight) || 720;
        this.host.style.maxHeight = `${Math.max(0, Math.min(maximum, view.innerHeight - rect.top - 8))}px`;
    }
    close() {
        this.cancelClose(); this.opened = false; this.generation++;
        if (ownedPopoverRoots(this.host).length) closeOwnedPopover(this.box.ownerDocument);
        this.options.jquery(this.host).hide();
    }
    dispose() { this.scope.dispose(); }
}
