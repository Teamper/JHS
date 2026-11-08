// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { shortcutFromEvent, shortcutMatches } from "../../core/detail-shortcuts.js";
import { movieCodeTokens } from "../../core/movie-code-evidence.js";
import { PRIVACY_DOCUMENT_TITLE_ATTRIBUTE } from "../../contracts/privacy-targets.js";
import { createPrivacyPreferences } from "../../ui/settings/privacy-controls.js";

export class PrivacyController {
    /** @param {{host: any, privacy: any, settings: any, scope: LifecycleScope, ui: any, dialog: any, notifications: any}} options */
    constructor(options) {
        this.host = options.host;
        this.privacy = options.privacy;
        this.settings = options.settings;
        this.scope = options.scope;
        this.ui = options.ui;
        this.dialog = options.dialog;
        this.notifications = options.notifications;
        this.document = /** @type {Document} */ (options.host.document);
        this.window = /** @type {Window & typeof globalThis} */ (this.document.defaultView);
        this.dialogScope = /** @type {LifecycleScope | null} */ (null);
        this.targetsKey = "";
        /** @type {Map<Element, string>} */ this.titles = new Map();
        this.documentTitle = /** @type {string | null} */ (null);
    }
    async start() {
        await this.privacy.load();
        this.scope.assertActive();
        this.privacy.setActive?.(true);
        const update = () => this.update();
        this.scope.listen(this.privacy, "privacy.changed", update);
        this.scope.listen(this.settings, "settings.changed", update);
        this.scope.listen(this.window, "blur", () => this.privacy.reveal(false));
        this.scope.listen(this.document, "visibilitychange", () => this.privacy.reveal(false));
        this.scope.observe(this.document.head, () => {
            if (this.privacy.masked && this.privacy.targets().includes("title") && this.document.title !== "JHS 隐私遮罩") this.update();
        }, { childList: true, subtree: true, characterData: true });
        this.scope.listen(this.document, "play", (/** @type {Event} */ event) => { if (this.privacy.enabled && event.target instanceof this.window.HTMLMediaElement) event.target.pause(); }, true);
        this.scope.listen(this.document, "keydown", rawEvent => {
            const event = /** @type {KeyboardEvent} */ (rawEvent);
            if (event.defaultPrevented || event.target instanceof this.window.Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],video,audio')) return;
            if (["Enter", "NumpadEnter", "Space"].includes(event.code) && event.target instanceof this.window.Element && event.target.closest('button,a[href],[role="button"],[role="link"]')) return;
            if (shortcutMatches(this.settings.snapshot().privacyShortcut, shortcutFromEvent(event))) { event.preventDefault(); this.toggle(); }
        });
        this.scope.observe(this.document.body, records => {
            if (!this.privacy.enabled) return;
            if (records.some(record => record.removedNodes.length)) for (const [node, title] of this.titles) {
                if (node.isConnected) continue;
                if (node.getAttribute("title") === "") node.setAttribute("title", title);
                node.removeAttribute("data-jhs-privacy-original-title");
                this.titles.delete(node);
            }
            for (const record of records) for (const node of record.addedNodes) {
                if (node.nodeType === 1) this.mark(/** @type {Element} */ (node));
                else if (node.nodeType === 3 && node.parentElement && !node.parentElement.hasAttribute("data-jhs-privacy-text")) this.mark(node.parentElement);
            }
        }, { childList: true, subtree: true });
        this.scope.addCleanup(() => {
            this.privacy.setActive?.(false);
            this.dialogScope?.dispose();
            this.restoreTitles();
            this.document.documentElement.removeAttribute("data-jhs-privacy-active");
            this.clearMarks();
        });
        this.update();
    }
    toggle() { void this.privacy.toggle().catch(() => this.notifications.error("隐私遮罩状态保存失败")); }
    update() {
        if (this.scope.disposed) return;
        const targetsKey = JSON.stringify(this.privacy.targets());
        if (targetsKey !== this.targetsKey || !this.privacy.enabled) {
            this.restoreTitles();
            this.clearMarks();
            this.targetsKey = targetsKey;
        }
        this.document.documentElement.toggleAttribute("data-jhs-privacy-active", this.privacy.masked);
        if (!this.privacy.masked) this.restoreTitles();
        if (this.privacy.masked && this.privacy.targets().includes("title")) {
            if (this.document.title !== "JHS 隐私遮罩") {
                this.documentTitle = this.document.title;
                this.document.documentElement.setAttribute(PRIVACY_DOCUMENT_TITLE_ATTRIBUTE, this.documentTitle);
                this.document.title = "JHS 隐私遮罩";
            }
        }
        if (this.privacy.enabled) {
            for (const video of this.document.querySelectorAll("video")) video.pause();
            this.mark(this.document.body);
        }
        for (const button of this.document.querySelectorAll('[data-jhs-privacy-toggle]')) {
            button.setAttribute("aria-pressed", String(this.privacy.enabled));
            button.textContent = this.privacy.enabled ? "关闭隐私遮罩" : "隐私遮罩";
        }
    }
    /** @param {Element} root */
    mark(root) {
        const selectors = this.host.getPrivacySelectors();
        for (const kind of this.privacy.targets()) {
            const selector = selectors[kind];
            if (!selector) continue;
            const nodes = [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
            for (const node of nodes) {
                if (node.closest(".jhs-privacy-config,.jhs-privacy-tools")) continue;
                if (node.matches(".layui-layer-title") && !movieCodeTokens(node.textContent || "").length) continue;
                if (kind === "code" && node.matches("p,date") && !movieCodeTokens(node.textContent || "").length) continue;
                if (this.privacy.masked) {
                    let titleNode = /** @type {Element | null} */ (node);
                    while (titleNode && titleNode !== this.document.body) {
                        const title = titleNode.getAttribute("title");
                        if (title) { this.titles.set(titleNode, title); titleNode.setAttribute("data-jhs-privacy-original-title", title); titleNode.setAttribute("title", ""); }
                        titleNode = titleNode.parentElement;
                    }
                }
                if (["images", "video"].includes(kind)) { node.setAttribute("data-jhs-privacy-media", kind); continue; }
                const walker = this.document.createTreeWalker(node, 4);
                /** @type {Text[]} */ const texts = [];
                while (walker.nextNode()) {
                    const text = /** @type {Text} */ (walker.currentNode);
                    if (kind === "title" && text.parentElement?.closest(selectors.code)) continue;
                    if (text.data.trim() && !text.parentElement?.closest('[data-jhs-privacy-text],button,input,select,textarea,script,style,svg,[data-jhs-privacy-control]')) texts.push(text);
                }
                for (const text of texts) {
                    const span = this.document.createElement("span");
                    span.setAttribute("data-jhs-privacy-text", kind);
                    text.replaceWith(span);
                    span.append(text);
                }
            }
        }
    }
    clearMarks() {
        this.document.querySelectorAll("[data-jhs-privacy-media]").forEach(node => node.removeAttribute("data-jhs-privacy-media"));
        this.document.querySelectorAll("[data-jhs-privacy-text]").forEach(node => node.replaceWith(...node.childNodes));
    }
    restoreTitles() {
        for (const [node, title] of this.titles) {
            if (node.getAttribute("title") === "") node.setAttribute("title", title);
            node.removeAttribute("data-jhs-privacy-original-title");
        }
        this.titles.clear();
        const documentTitle = this.document.documentElement.getAttribute(PRIVACY_DOCUMENT_TITLE_ATTRIBUTE) ?? this.documentTitle;
        if (documentTitle !== null && this.document.title === "JHS 隐私遮罩") this.document.title = documentTitle;
        this.document.documentElement.removeAttribute(PRIVACY_DOCUMENT_TITLE_ATTRIBUTE);
        this.documentTitle = null;
    }
    /** Hold gestures belong to the control's mounting scope. @param {HTMLElement} button @param {LifecycleScope} scope */
    bindReveal(button, scope) {
        const release = () => this.privacy.reveal(false);
        scope.listen(button, "pointerdown", rawEvent => {
            const event = /** @type {PointerEvent} */ (rawEvent);
            if (event.button !== 0) return;
            button.setPointerCapture?.(event.pointerId);
            this.privacy.reveal(true);
        });
        scope.listen(button, "keydown", rawEvent => {
            const event = /** @type {KeyboardEvent} */ (rawEvent); if (event.code === "Space") { event.preventDefault(); this.privacy.reveal(true); } });
        scope.listen(button, "keyup", rawEvent => {
            const event = /** @type {KeyboardEvent} */ (rawEvent); if (event.code === "Space") { event.preventDefault(); release(); } });
        for (const type of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) scope.listen(button, type, release);
        scope.addCleanup(release);
    }
    configure() {
        if (this.dialogScope && !this.dialogScope.disposed) return;
        const scope = new LifecycleScope("privacy:preferences"), focused = this.document.activeElement;
        this.dialogScope = scope;
        let id = 0;
        let closed = false, releaseOwner = () => {};
        scope.addCleanup(() => releaseOwner());
        const root = createPrivacyPreferences({ document: this.document, scope, settings: this.settings, onClose: () => this.dialog.close(id) });
        root.style.display = "none";
        this.document.body.append(root);
        scope.addCleanup(() => { root.remove(); if (focused instanceof this.window.HTMLElement && focused.isConnected) focused.focus(); });
        try {
            id = this.dialog.open({ type: 1, title: "隐私遮罩偏好", content: this.ui.jquery(root), ui: { size: "form", body: "scroll" }, shadeClose: true, end: () => { closed = true; scope.dispose(); } });
            if (!closed) releaseOwner = this.scope.addCleanup(() => { if (!closed) this.dialog.close(id); scope.dispose(); });
        } catch (error) { scope.dispose(); throw error; }
    }
}
