// @ts-check

import { B, normalizeCarNum } from "../../core/constants.js";
import { createListEvaluationContext } from "./list-evaluator.js";

/** Assemble the one evaluation snapshot shared by visible-list filtering and cross-page scans. */
/** @param {any} sources @param {{now?: number, onMissingBlacklistRole?: (item: any) => void}} [options] */
export function buildListFilterContext(sources, { now = Date.now(), onMissingBlacklistRole = () => {} } = {}) {
    const actorCarNumToNameMap = new Map(), actressCarNumToNameMap = new Map(), recentCarNums = new Set();
    const cutoff = now - 7 * 864e5;
    for (const entry of sources.activity?.entries ?? []) {
        if (entry.commitState !== "committed" || !(Date.parse(entry.createdAt) >= cutoff)) continue;
        for (const change of entry.changes ?? []) {
            if (change.undoState === "reverted" || !change.fields?.some((/** @type {string} */ field) => field.startsWith("stateFlags."))) continue;
            recentCarNums.add(change.carNum);
        }
    }
    for (const item of sources.blacklistCars ?? []) {
        const role = sources.blacklistMap?.get(item.starId)?.role;
        if (!role) {
            onMissingBlacklistRole(item);
            continue;
        }
        const target = role === B ? actorCarNumToNameMap : actressCarNumToNameMap;
        const carNum = normalizeCarNum(item.carNum);
        if (!target.has(carNum)) target.set(carNum, item.names);
    }
    return createListEvaluationContext({
        titleKeywords: sources.titleKeywords,
        settings: sources.settings,
        carMap: sources.carMap,
        recentCarNums,
        actorCarNumToNameMap,
        actressCarNumToNameMap,
    });
}

/** Cache one source snapshot and reject stale in-flight reads after invalidation. */
export class ListFilterContextProvider {
    /** @param {{readSources: () => Promise<any>, onMissingBlacklistRole?: (item: any) => void, now?: () => number}} options */
    constructor(options) {
        this.readSources = options.readSources;
        this.onMissingBlacklistRole = options.onMissingBlacklistRole ?? (() => {});
        this.now = options.now ?? Date.now;
        /** @type {ReturnType<typeof buildListFilterContext> | null} */ this.value = null;
        /** @type {Promise<ReturnType<typeof buildListFilterContext>> | null} */ this.pending = null;
        this.generation = 0;
        this.disposed = false;
    }

    get() {
        if (this.disposed) return Promise.reject(new DOMException("List filter context provider is disposed", "AbortError"));
        if (this.value) return Promise.resolve(this.value);
        if (this.pending) return this.pending;
        const generation = this.generation;
        const pending = Promise.resolve()
            .then(() => this.readSources())
            .then((sources) => {
                const value = buildListFilterContext(sources, { now: this.now(), onMissingBlacklistRole: this.onMissingBlacklistRole });
                if (!this.disposed && generation === this.generation) this.value = value;
                return value;
            })
            .finally(() => { if (this.pending === pending) this.pending = null; });
        this.pending = pending;
        return pending;
    }

    invalidate() {
        if (this.disposed) return;
        this.generation += 1;
        this.value = null;
        this.pending = null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        this.value = null;
        this.pending = null;
    }
}
