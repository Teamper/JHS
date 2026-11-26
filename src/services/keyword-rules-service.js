// @ts-check

import { readReviewKeywords } from "../core/review-keywords.js";

const TITLE_KEY = "filter_keyword_title", REVIEW_KEY = "filter_keyword_review";

/** Owns the title and review rules stored in the portable data domains. */
export class KeywordRulesService {
    /** @param {{storage: import("./storage-service.js").StorageService, coordinator: import("../core/storage-mutation-coordinator.js").StorageMutationCoordinator, state: import("../core/state-service.js").StateService}} dependencies */
    constructor({ storage, coordinator, state }) {
        this.storage = storage;
        this.coordinator = coordinator;
        this.state = state;
    }

    /** @returns {Promise<string[]>} */
    async getTitleKeywords() { return await this.storage.get(TITLE_KEY) || []; }

    getReviewKeywords() { return this.coordinator.runExclusive(() => this.getReviewKeywordsWithoutLock()); }

    /** Caller owns the mutation lock. @param {string} [addition] */
    getReviewKeywordsWithoutLock(addition) {
        return readReviewKeywords({
            get: key => this.storage.get(key),
            set: (key, value) => this.storage.set(key, value),
            remove: key => this.storage.remove(key),
        }, addition, { alreadyLocked: true });
    }

    /** @param {string} keyword */
    addReviewKeyword(keyword) { return this.coordinator.runExclusive(() => this.getReviewKeywordsWithoutLock(keyword)); }

    /** @param {string[]} keywords */
    saveReviewKeywords(keywords) { return this.coordinator.runExclusive(() => this.storage.set(REVIEW_KEY, [...keywords])); }

    /** @param {string|string[]} keywords */
    saveTitleKeywords(keywords) {
        return this.coordinator.runExclusive(async () => {
            if (Array.isArray(keywords)) return this.storage.set(TITLE_KEY, [...keywords]);
            const current = await this.getTitleKeywords();
            if (current.includes(keywords)) throw Object.assign(new Error(`${keywords} 标题关键词已存在`), { code: "DUPLICATE_TITLE_KEYWORD" });
            await this.storage.set(TITLE_KEY, [...current, keywords]);
            await this.state.pruneNewVideoByTitleKeywordWithoutLock(keywords);
        });
    }
}
