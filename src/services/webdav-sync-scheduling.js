// @ts-check

/** @typedef {Record<string, any>} SyncState */
/** Pending bytes are ready to retry; missing or future deadlines must not delay repair. @param {SyncState} state @param {number} now */
export function syncPublishDueAt(state, now) {
    if (state.pending) return now;
    if (!state.dirty) return Infinity;
    const first = Number(state.dirtySinceAt), last = Number(state.lastLocalChangeAt);
    if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last < first || first > now || last > now) return now;
    return Math.min(last + 5000, first + 30000);
}

/** One shared policy for event wakes, refreshes and operation completion. @param {SyncState} state @param {number} now @param {boolean} hidden @param {string} revision @param {boolean} [lockMiss] @returns {number | null} */
export function nextSyncDelay(state, now, hidden, revision, lockMiss = false) {
    const interval = hidden ? 120000 : 30000;
    if (state.errorRevision === revision) {
        if (state.paused) return null;
        if (state.retryAt > now) return state.retryAt - now;
    }
    const publishAt = syncPublishDueAt(state, now);
    const pollAt = state.joined && state.checkedRevision === revision && state.lastCheckAt <= now
        ? Math.min(Number(state.nextCheckAt) || now, (Number(state.lastCheckAt) || now) + interval) : now;
    const cleanupAt = state.cleanupError || state.deleting?.length ? Number(state.cleanupRetryAt) || now : Infinity;
    let delay = Math.max(0, Math.min(publishAt, pollAt, cleanupAt) - now);
    if (lockMiss) delay = Math.max(delay, Number.isFinite(publishAt) ? 1000 : interval);
    return delay;
}
