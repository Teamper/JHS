// @ts-check

import { l, r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { ReviewPanel } from "../../ui/detail/review-panel.js";

export class ReviewPlugin extends BasePlugin {
    getName() {
        return "ReviewPlugin";
    }
    async handle() {
        if (!window.isDetailPage) return;
        if (r) {
            const movieId = this.parseMovieId(window.location.href);
            await this.showReview(movieId, this.getHostedSlot("reviews"));
        }
        if (l) {
            if (this.getRuntimeService("settings").snapshot().enableLoadReview === "no") return;
            const carNumber = this.getPageInfo().carNum;
            if (!carNumber) return void clog.warn("跳过 JavBus 评论解析：番号不可用");
            const scope = await this.getRuntimeService("scope")();
            const movieRef = await this.getRuntimeService("movie").resolve({ carNum: carNumber }, { scope });
            movieRef?.movieId && await this.showReview(movieRef.movieId, this.getHostedSlot("reviews"));
        }
    }
    getHostedSlot(/** @type {string} */ name) {
        const element = this.getRuntimeService("host").locateDetailSlots()[name];
        return element ? $(element) : $();
    }
    async showReview(/** @type {string} */ movieId, /** @type {any} */ target, /** @type {Record<string, unknown>} */ options = {}) {
        const panel = new ReviewPanel({ review: this.getRuntimeService("review"), settings: this.getRuntimeService("settings"), storage: this.getRuntimeService("storage"), scope: () => this.getRuntimeService("scope")() });
        return panel.show(movieId, target?.length ? target : this.getHostedSlot("reviews"), options);
    }
}
