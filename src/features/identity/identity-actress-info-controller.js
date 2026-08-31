// @ts-check

/** Own JavDB actress information lookup, rendering, and scoped cleanup. */
export class IdentityActressInfoController {
    /** @param {{hostAdapter?: any, settings: any, actressInfo: any, styles?: any, scope: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.window = this.document?.defaultView ?? globalThis.window;
        this.site = options.hostAdapter?.site ?? "unknown";
        this.settings = options.settings;
        this.actressInfo = options.actressInfo;
        this.styles = options.styles;
        this.scope = options.scope;
        this.started = false;
        this.generation = 0;
    }

    getJQuery() { return /** @type {any} */ (globalThis).$ ?? this.window?.jQuery; }
    getClog() { return /** @type {any} */ (globalThis).clog ?? {}; }

    /** Start the actress information contribution and own its settings listener. */
    async start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        const removeStyle = this.styles?.register?.("identity-actress-info", this.initCss());
        if (typeof removeStyle === "function") this.scope.addCleanup?.(removeStyle);
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("enableLoadActressInfo")) return;
            if (this.settings.snapshot().enableLoadActressInfo === "no") this.unmount();
            else void this.mount().catch((error) => this.getClog().error?.("演员信息重新挂载失败", error));
        };
        if (this.scope.listen) this.scope.listen(this.settings, "settings.changed", onSettingsChanged);
        else {
            this.settings.addEventListener("settings.changed", onSettingsChanged);
            this.scope.addCleanup?.(() => this.settings.removeEventListener("settings.changed", onSettingsChanged));
        }
        this.scope.addCleanup?.(() => this.dispose());
        try { await this.mount(); }
        catch (error) { this.dispose(); throw error; }
    }

    initCss() {
        return `
            .info-tag { background-color:var(--jhs-status-fav-tint); display:inline-block; height:32px; padding:0 10px; line-height:30px; font-size:12px; color:var(--jhs-status-fav); border:1px solid var(--jhs-status-fav-tint); border-radius:4px; box-sizing:border-box; white-space:nowrap; }
        `;
    }

    async mount() {
        this.scope.assertActive();
        if (this.site !== "javdb" || this.settings.snapshot().enableLoadActressInfo === "no") return;
        this.generation += 1;
        const path = this.window?.location?.pathname ?? "";
        if (path.startsWith("/v/") || path.startsWith("/movies/")) await this.handleDetailPage();
        else if (path.startsWith("/actors/")) await this.handleStarPage();
    }

    unmount() {
        this.generation += 1;
        this.getJQuery()?.(this.document).find?.(".actress-info").remove();
    }

    /** @param {number} generation */
    isStillActive(generation) {
        return generation === this.generation && !this.scope.disposed && this.settings.snapshot().enableLoadActressInfo !== "no";
    }

    async handleDetailPage() {
        const $ = this.getJQuery();
        if ($(".actress-info").length > 0) return;
        const generation = this.generation;
        const actressLinks = $(this.document).find(".female");
        const names = actressLinks.prev().map((/** @type {number} */ _index, /** @type {Element} */ item) => $(item).text().trim()).get();
        if (!names.length) return;
        /** @type {any[]} */ const blocks = [];
        for (const name of names) {
            let info = null;
            try { info = await this.searchInfo(name); }
            catch (error) { this.getClog().error?.("演员资料查询失败", name, error); }
            if (!this.isStillActive(generation)) return;
            const block = $('<div class="panel-block actress-info"></div>');
            if (info) {
                block.append($("<strong></strong>").text(`${name}:`));
                const link = $("<a></a>").attr({ href: info.url, target: "_blank", rel: "noopener noreferrer" }).addClass("jhs-layout-9813a0dd");
                link.append(
                    $("<span></span>").addClass("info-tag").text(`${info.birthday} ${info.age}`.trim()),
                    $("<span></span>").addClass("info-tag").text(`${info.height} ${info.weight}`.trim()),
                    $("<span></span>").addClass("info-tag").text(`${info.threeSizeText} ${info.braSize}`.trim()),
                );
                block.append(link);
            } else {
                const href = this.actressInfo.profileUrl(name);
                block.append($("<a></a>").attr({ href, target: "_blank", rel: "noopener noreferrer" }).append($("<strong></strong>").text(`${name}:`)));
            }
            blocks.push(block);
        }
        if (!this.isStillActive(generation)) return;
        const anchor = $(this.document).find("strong").filter((/** @type {number} */ _index, /** @type {Element} */ element) => /^(?:演員|演员)\s*:?$/.test($(element).text().trim())).first().parent();
        const fallback = actressLinks.first().closest(".panel-block");
        anchor.length ? anchor.after(...blocks) : fallback.after(...blocks);
    }

    async handleStarPage() {
        const $ = this.getJQuery();
        if ($(".actress-info").length > 0) return;
        const generation = this.generation;
        /** @type {string[]} */ const names = [];
        const title = $(this.document).find(".actor-section-name");
        if (title.length) title.text().trim().split(",").forEach((/** @type {string} */ name) => names.push(name.trim()));
        const meta = $(this.document).find(".section-meta:not(:contains('影片'))");
        if (meta.length) meta.text().trim().split(",").forEach((/** @type {string} */ name) => names.push(name.trim()));
        if (!names.length) return;
        let info = null;
        for (const name of names) {
            try { info = await this.searchInfo(name); }
            catch (error) { this.getClog().error?.("演员资料查询失败", name, error); }
            if (!this.isStillActive(generation)) return;
            if (info) break;
        }
        const body = $('<div class="jhs-layout-c0d4a511"></div>');
        if (!info) body.text("无此相关演员信息");
        else {
            const row1 = $('<div class="jhs-layout-1b3790ef"></div>'), row2 = $('<div class="jhs-layout-1b3790ef"></div>');
            row1.append($("<span></span>").addClass("jhs-layout-dd5a75f6").text(`出生日期: ${info.birthday}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`年龄: ${info.age}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`身高: ${info.height}`));
            row2.append($("<span></span>").addClass("jhs-layout-dd5a75f6").text(`体重: ${info.weight}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`三围: ${info.threeSizeText}`), $("<span></span>").addClass("jhs-layout-d4a09a0d").text(`罩杯: ${info.braSize}`));
            body.append(row1, row2);
        }
        if (!this.isStillActive(generation)) return;
        const result = info ? $("<a></a>").addClass("actress-info").attr({ href: info.url, target: "_blank", rel: "noopener noreferrer" }).append(body) : body.addClass("actress-info");
        title.parent().append(result);
    }

    /** @param {string} name */
    async searchInfo(name) { return this.actressInfo.lookup(name, { scope: this.scope }); }

    dispose() {
        this.unmount();
        this.started = false;
    }
}
