// @ts-check

import { normalizeCarNum } from "../../core/constants.js";
import { countPendingNewVideos, getPendingNewVideoCarNumbers, isNewVideoDecisionHidden } from "../../core/new-video-model.js";
import { normalizeStateFlags } from "../../core/state-model.js";

/** Combine actress-owned legacy entries into the workspace's canonical movie rows. */
/** @param {any[]} actresses @param {Map<string, any>} carMap @param {Record<string, any>} decisions @param {number} [now] */
export function aggregateNewVideoRecords(actresses, carMap, decisions, now = Date.now()) {
    const grouped = new Map();
    for (const actress of actresses) {
        if (!Array.isArray(actress.newVideoList)) continue;
        for (const raw of actress.newVideoList) {
            const item = "object" == typeof raw ? raw : {}, carNum = normalizeCarNum("string" == typeof raw ? raw : raw.carNum);
            if (!carNum) continue;
            const existing = grouped.get(carNum) || { carNum, coverUrl: "", title: "", publishTime: "", actresses: [], starIds: [], categories: new Set(), score: 0, voteCount: 0, url: "", isVr: false };
            existing.coverUrl ||= item.coverUrl || "", existing.title ||= item.title || "", existing.publishTime = [existing.publishTime, item.publishTime || ""].sort().at(-1), existing.score = Math.max(existing.score, Number(item.score) || 0), existing.voteCount = Math.max(existing.voteCount, Number(item.voteCount) || 0), existing.url ||= item.url || "";
            existing.isVr ||= true === item.isVr || /(^|[^A-Z])VR([^A-Z]|$)/i.test(`${item.title || ""} ${(item.tags || []).join?.(" ") || ""} ${(item.categories || []).join?.(" ") || ""}`);
            actress.name && !existing.actresses.includes(actress.name) && existing.actresses.push(actress.name), actress.starId && !existing.starIds.includes(actress.starId) && existing.starIds.push(actress.starId), actress.actressType && existing.categories.add(actress.actressType), grouped.set(carNum, existing);
        }
    }
    return [...grouped.values()].map((item) => {
        const record = carMap.get(item.carNum), flags = normalizeStateFlags(record?.stateFlags), decision = decisions[item.carNum] || null, decisionState = !decision ? "pending" : "snoozed" === decision.action && decision.until && Date.parse(decision.until) <= now ? "pending" : decision.action;
        return { ...item, actressName: item.actresses.join("、"), starId: item.starIds[0] || "", categories: [...item.categories], flags, decision, decisionState };
    });
}

/** Reads the new-video workspace snapshot through feature-injected services. */
export class NewVideoWorkspaceController {
    /** @param {{state: any, settings: any, movie: any}} services */
    constructor(services) {
        this.state = services.state;
        this.settings = services.settings;
        this.movie = services.movie;
        this.disposed = false;
    }

    async getPendingSummary() {
        this.assertActive();
        const [carMap, actresses, decisions] = await Promise.all([
            this.state.getCarMap(),
            this.state.getFavoriteActressList(),
            this.state.getNewVideoDecisions(),
        ]);
        this.assertActive();
        return { count: countPendingNewVideos(actresses, carMap, decisions), decisions };
    }

    /** Count one actress's unique, still-pending titles using the shared workspace snapshot. */
    /** @param {any} actress @param {Map<string, any>} carMap @param {Record<string, any>} decisions */
    getPendingNewVideoCount(actress, carMap, decisions) {
        return this.getPendingCarNumbers(actress, carMap, decisions).size;
    }

    /** @param {any} actress @param {Map<string, any>} carMap @param {Record<string, any>} decisions */
    getPendingCarNumbers(actress, carMap, decisions) {
        return getPendingNewVideoCarNumbers(actress, carMap, decisions);
    }

    async loadWorkspace() {
        this.assertActive();
        const settings = this.settings.snapshot();
        const [actresses, carMap, decisions] = await Promise.all([
            this.state.getFavoriteActressList(),
            this.state.getCarMap(),
            this.state.getNewVideoDecisions(),
        ]);
        this.assertActive();
        const items = aggregateNewVideoRecords(actresses, carMap, decisions);
        return {
            actresses, carMap, decisions, items, ruleTime: settings.checkNewVideo_ruleTime ?? 8760,
            javDbUrl: this.movie.externalSiteOrigin("javDbBtn", settings),
        };
    }

    /** Stop delayed reads from handing stale workspace data back to a closed Feature. */
    dispose() {
        this.disposed = true;
    }

    /** @param {any} decision */
    isDecisionHidden(decision) {
        return isNewVideoDecisionHidden(decision);
    }

    assertActive() {
        if (this.disposed) throw Object.assign(new Error("New-video workspace is closed"), { name: "AbortError" });
    }
}
