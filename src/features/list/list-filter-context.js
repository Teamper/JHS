// @ts-check

import { B, normalizeCarNum } from "../../core/constants.js";
import { createListEvaluationContext } from "./list-evaluator.js";

/** Assemble the one evaluation snapshot shared by visible-list filtering and cross-page scans. */
/** @param {any} sources @param {{now?: number, onMissingBlacklistRole?: (item: any) => void}} [options] */
export function buildListFilterContext(sources, { now = Date.now(), onMissingBlacklistRole = () => {} } = {}) {
    const actorCarNumToNameMap = new Map(), actressCarNumToNameMap = new Map(), recentCarNums = new Set();
    let recentExpiresAt = Infinity;
    const cutoff = now - 7 * 864e5;
    for (const entry of sources.activity?.entries ?? []) {
        const createdAt = Date.parse(entry.createdAt);
        if (entry.commitState !== "committed" || !(createdAt >= cutoff)) continue;
        for (const change of entry.changes ?? []) {
            if (change.undoState === "reverted" || !change.fields?.some((/** @type {string} */ field) => field.startsWith("stateFlags."))) continue;
            recentCarNums.add(change.carNum);
            recentExpiresAt = Math.min(recentExpiresAt, createdAt + 7 * 864e5 + 1);
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
    return { ...createListEvaluationContext({
        titleKeywords: sources.titleKeywords,
        settings: sources.settings,
        carMap: sources.carMap,
        recentCarNums,
        actorCarNumToNameMap,
        actressCarNumToNameMap,
    }), recentExpiresAt };
}

/** Cache one source snapshot and reject stale in-flight reads after invalidation. */
export class ListFilterContextProvider {
    /** @param {{readSources: (options?: {stateOnly?: boolean}) => Promise<any>, onMissingBlacklistRole?: (item: any) => void, now?: () => number}} options */
    constructor(options) {
        this.readSources = options.readSources;
        this.onMissingBlacklistRole = options.onMissingBlacklistRole ?? (() => {});
        this.now = options.now ?? Date.now;
        /** @type {ReturnType<typeof buildListFilterContext> | null} */ this.value = null;
        /** @type {Promise<ReturnType<typeof buildListFilterContext>> | null} */ this.pending = null;
        this.generation = 0;
        this.disposed = false;
        /** @type {ReturnType<typeof buildListFilterContext> | null} */ this.rules = null;
        /** @type {(() => any) | null} */ this.readCommitted = null;
        this.recentExpiresAt = Infinity;
    }

    get() {
        if (this.disposed) return Promise.reject(new DOMException("List filter context provider is disposed", "AbortError"));
        if (this.value && this.now() >= this.recentExpiresAt) this.invalidateState();
        if (this.value) return Promise.resolve(this.value);
        if (this.pending) return this.pending;
        const generation = this.generation, rules = this.rules, readCommitted = this.readCommitted;
        const pending = Promise.resolve()
            .then(() => {
                const snapshot = rules && this.now() < this.recentExpiresAt && readCommitted?.();
                if (!snapshot) return this.readSources({ stateOnly: !!rules });
                const carMap = new Map(rules.carMap), recentCarNums = new Set(rules.recentCarNums);
                for (const [key, record] of snapshot.records) record ? carMap.set(key, record) : carMap.delete(key);
                for (const key of snapshot.recentCarNums) recentCarNums.add(key);
                return { carMap, recentCarNums, recentExpiresAt: Math.min(this.recentExpiresAt, snapshot.recentExpiresAt ?? Infinity) };
            })
            .then((sources) => {
                const state = buildListFilterContext(sources, { now: this.now(), onMissingBlacklistRole: this.onMissingBlacklistRole });
                const value = rules ? { ...rules, carMap: state.carMap, recentCarNums: sources.recentCarNums ?? state.recentCarNums, recentExpiresAt: sources.recentExpiresAt ?? state.recentExpiresAt } : state;
                if (!this.disposed && generation === this.generation) { this.value = value; this.rules = value; this.recentExpiresAt = value.recentExpiresAt; this.readCommitted = null; }
                return value;
            })
            .finally(() => { if (this.pending === pending) this.pending = null; });
        this.pending = pending;
        return pending;
    }

    invalidate() {
        this.rules = null;
        this.invalidateState();
    }

    /** Keep rule maps across a scoped state change; a late read cannot install into the new generation.
     * @param {(() => any) | null} [readCommitted] */
    invalidateState(readCommitted = null) {
        if (this.disposed) return;
        const baseCurrent = this.value !== null;
        this.generation += 1;
        this.value = null;
        this.pending = null;
        // An unconsumed off-list change means rules.carMap is no longer a
        // complete state baseline, even if the next commit delta itself is fresh.
        this.readCommitted = baseCurrent ? readCommitted : null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        this.value = null;
        this.pending = null;
        this.rules = null; this.readCommitted = null;
    }
}
