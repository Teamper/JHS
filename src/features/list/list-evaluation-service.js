// @ts-check

import { B, normalizeCarNum } from "../../core/constants.js";
import { createListEvaluationContext } from "./list-evaluator.js";

/** Own the cached list evaluation context and its storage-backed refresh boundary. */
export class ListEvaluationService {
    /** @param {{scope: any, storage: any, stateService: any}} options */
    constructor(options) {
        this.scope = options.scope;
        this.storage = options.storage;
        this.stateService = options.stateService;
        /** @type {any} */ this.context = null;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** Load the storage snapshot used by page filtering and batch evaluation. */
    async getContext() {
        this.scope.assertActive();
        if (this.context) return this.context;
        const [titleKeywords, blacklistMap, blacklistCars, settings, carMap, activity] = await Promise.all([
            this.storage.getTitleFilterKeyword(),
            this.storage.getBlacklistMap(),
            this.storage.getBlacklistCarList(),
            this.storage.getSetting(),
            this.storage.getCarMap(),
            this.stateService.getActivityLog(),
        ]);
        this.scope.assertActive();
        const actorCarNumToNameMap = new Map(), actressCarNumToNameMap = new Map(), recentCarNums = new Set(), cutoff = Date.now() - 7 * 864e5;
        activity.entries
            .filter((/** @type {any} */ entry) => "committed" === entry.commitState && Date.parse(entry.createdAt) >= cutoff)
            .forEach((/** @type {any} */ entry) => {
                entry.changes
                    .filter((/** @type {any} */ change) => "reverted" !== change.undoState && change.fields?.some((/** @type {string} */ field) => field.startsWith("stateFlags.")))
                    .forEach((/** @type {any} */ change) => recentCarNums.add(change.carNum));
            });
        for (const item of blacklistCars) {
            const role = blacklistMap.get(item.starId)?.role;
            if (!role) {
                /** @type {any} */ (globalThis).clog?.error?.("黑名单数据源丢失演员信息", item);
                continue;
            }
            const target = role === B ? actorCarNumToNameMap : actressCarNumToNameMap, carNum = normalizeCarNum(item.carNum);
            target.has(carNum) || target.set(carNum, item.names);
        }
        this.context = { titleKeywords, settings, carMap, recentCarNums, actorCarNumToNameMap, actressCarNumToNameMap };
        return this.context;
    }

    /** Return the canonical evaluator context used by list filtering and batch operations. */
    async createEvaluationContext() {
        return createListEvaluationContext(await this.getContext());
    }

    /** Drop the cached snapshot after settings, blacklist, or state changes. */
    invalidate() {
        this.context = null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.context = null;
    }
}
