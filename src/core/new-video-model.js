// @ts-check

import { normalizeCarNum } from "./constants.js";
import { hasAnyState, normalizeStateFlags } from "./state-model.js";

/** @param {any} decision @param {number} [now] */
export function isNewVideoDecisionHidden(decision, now = Date.now()) {
    if (!decision) return false;
    if (["ignored", "dismissed"].includes(decision.action)) return true;
    return decision.action === "snoozed" && (!decision.until || Date.parse(decision.until) > now);
}

/** @param {any} actress @param {Map<string, any>} carMap @param {Record<string, any>} decisions @param {number} [now] */
export function getPendingNewVideoCarNumbers(actress, carMap, decisions, now = Date.now()) {
    const pending = new Set();
    if (!Array.isArray(actress?.newVideoList)) return pending;
    for (const record of actress.newVideoList) {
        const carNum = normalizeCarNum(typeof record === "string" ? record : record?.carNum);
        if (!carNum || hasAnyState(normalizeStateFlags(carMap.get(carNum)?.stateFlags))) continue;
        if (isNewVideoDecisionHidden(decisions[carNum], now)) continue;
        pending.add(carNum);
    }
    return pending;
}

/** @param {any[]} actresses @param {Map<string, any>} carMap @param {Record<string, any>} decisions @param {number} [now] */
export function countPendingNewVideos(actresses, carMap, decisions, now = Date.now()) {
    const pending = new Set();
    for (const actress of actresses) {
        for (const carNum of getPendingNewVideoCarNumbers(actress, carMap, decisions, now)) pending.add(carNum);
    }
    return pending.size;
}
