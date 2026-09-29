// @ts-check

import { escapeHtml } from "../../core/constants.js";
import { requestHostPage } from "../../core/host-page-request.js";

/** Own actor/tag blacklist entry, first-page capture and bounded pagination. */
export class BlacklistEntryController {
    /** @param {{document: Document, window: Window, location: Location, jquery: (value: any) => any, site: string, state: any, http: any, ui: any, notifications: any, logger: any, scope: any, task: any, getSubjectInfo: () => any, parsePage: (page: any, name: string, starId: string, site: string) => any}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.location = options.location;
        this.$ = options.jquery;
        this.site = options.site;
        this.state = options.state;
        this.http = options.http;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.logger = options.logger;
        this.scope = options.scope;
        this.task = options.task;
        this.getSubjectInfo = options.getSubjectInfo;
        this.parsePage = options.parsePage;
        /** @type {string | null} */ this.nextPageLink = null;
        /** @type {string | null} */ this.lastPageLink = null;
        this.active = true;
    }

    /** Add the current actor/tag after explicit confirmation, then scan from this page. */
    /** @param {any} event */
    addBlacklist(event) {
        this.assertActive();
        const position = { clientX: Number(event?.clientX) || 0, clientY: (Number(event?.clientY) || 0) + 80 };
        const info = this.getSubjectInfo();
        const alreadyAdded = this.$("#addBlacklistBtn span").text().includes("已加入");
        const isTag = info.role === "虚拟演员";
        const subjectLabel = isTag ? `分类 <span class="jhs-task-emphasis">${escapeHtml(info.movieType)}</span>` : `该演员 <span class="jhs-task-emphasis">${escapeHtml(info.name)}</span>`;
        const subjectName = isTag ? `分类 ${info.movieType}` : `演员 ${info.name}`;
        let message = alreadyAdded
            ? `${subjectLabel} 已在黑名单中, 是否从当前页开始追加屏蔽?`
            : `是否将${subjectLabel}加入到黑名单中?`;
        if (new URL(this.location.href).searchParams.get("page") && new URL(this.location.href).searchParams.get("page") !== "1") {
            message += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
        }
        if (this.site === "javbus") {
            const currentPage = Number(new URL(this.location.href).pathname.split("/").filter(Boolean).at(-1));
            if (Number.isFinite(currentPage) && currentPage > 1) message += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
        }
        this.ui.confirm(position, message, () => {
            void this.addAndScan(info).catch((error) => this.logger?.error?.("加入黑名单失败", subjectName, error));
        });
    }

    /** Save the actor record once, then commit each parsed page using the established storage API. */
    async addAndScan(info = this.getSubjectInfo()) {
        this.assertActive();
        if (!this.task) return this.notifications.error("后台任务功能已禁用，无法执行黑名单抓取");
        const locks = this.window.navigator?.locks;
        if (!locks?.request) return this.notifications.error("当前浏览器不支持后台任务互斥");
        return locks.request(this.task.singleTaskKey, { ifAvailable: true }, async (lock) => {
            this.assertActive();
            if (!lock) return this.notifications.error("当前有定时任务在后台执行中, 无法发起此操作");
            const loading = this.ui.loading();
            try {
                await this.state.addBlacklistItem({
                    starId: info.starId, name: info.name, allName: info.allName,
                    role: info.role, movieType: info.movieType, url: info.blacklistUrl,
                });
                const result = await this.scanPages(info.name, info.starId, this.$(this.document), this.site);
                const page = result.lastPageLink || this.location.href;
                this.notifications.ok(`屏蔽结束,是否跳转到最后一页: ${page}`, {
                    duration: -1, close: true,
                    onClick: () => { this.window.location.href = page; },
                });
                return result;
            } catch (error) {
                this.logger?.error?.("演员黑名单扫描失败", error);
                const failedPage = this.nextPageLink || this.location.href;
                this.notifications.error("发生错误, 是否跳转到解析失败的那一页? (点击并跳转)", {
                    duration: -1, close: true,
                    onClick: () => { this.window.location.href = failedPage; },
                });
                throw error;
            } finally {
                loading?.close?.();
            }
        });
    }

    /** @param {string} name @param {string} starId @param {any} firstPage @param {string} site */
    async scanPages(name, starId, firstPage, site) {
        this.nextPageLink = null;
        this.lastPageLink = this.location.href;
        const visited = new Set([this.location.href]);
        let page = firstPage, pageNumber = 0, processed = 0;
        while (pageNumber < 200) {
            this.assertActive();
            pageNumber += 1;
            const parsed = await this.parsePage(page, name, starId, site);
            await this.state.batchSaveBlacklistCarList(parsed.records);
            processed += parsed.recordCount;
            this.$("#checkBlacklistMsg").text(`正在处理第 ${pageNumber} 页 · 已屏蔽 ${processed} 个番号`);
            const next = /** @type {string | null} */ (parsed.nextPageLink ? new URL(parsed.nextPageLink, this.lastPageLink || this.location.href).href : null);
            this.nextPageLink = next;
            if (!next || visited.has(next)) {
                this.$("#checkBlacklistMsg").text(`处理完成 · ${pageNumber} 页 · 新增 ${processed} 个番号`);
                return { pages: pageNumber, processed, lastPageLink: this.lastPageLink };
            }
            visited.add(next);
            this.lastPageLink = next;
            page = this.$(this.parseDocument(await requestHostPage(this.http, next, this.scope)));
        }
        this.$("#checkBlacklistMsg").text(`已达到页数上限（200 页），已停止 · 已屏蔽 ${processed} 个番号`);
        this.logger?.warn?.("演员视频分页扫描已达上限，已停止");
        return { pages: pageNumber, processed, lastPageLink: this.lastPageLink, truncated: true };
    }

    /** Parse fetched markup into a detached document so the current page remains untouched. @param {string} html */
    parseDocument(html) {
        const Parser = /** @type {any} */ (this.window).DOMParser;
        if (!Parser) throw new Error("当前浏览器不支持演员列表页面解析");
        return new Parser().parseFromString(html, "text/html");
    }

    /** @param {string} name @param {string} starId @param {any} page @param {string} site */
    parseBlacklistFilterInfo(name, starId, page, site) {
        this.assertActive();
        return this.parsePage(page, name, starId, site);
    }

    /** Legacy callers used this API to scan an already-open actor page. */
    /** @param {string} name @param {string} starId @param {any} page @param {string} [site] */
    filterActorVideo(name, starId, page, site = this.site) {
        this.assertActive();
        return this.scanPages(name, starId, page || this.$(this.document), site);
    }

    assertActive() {
        if (!this.active || this.scope?.disposed) throw Object.assign(new Error("Blacklist entry is closed"), { name: "AbortError" });
    }

    dispose() { this.active = false; }
}
