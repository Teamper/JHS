// @ts-check

export const ACTRESS_PROFILE_BACKFILL_KEY = "jhs_actress_profile_attempts_v1";
const SCHEMA = 4;

/** @typedef {{schema: typeof SCHEMA, generation: string | null, initialized: boolean, entries: Record<string, number>, actorRevisions: Record<string, string>}} ActressProfileBackfillState */
/** @typedef {Pick<ActressProfileBackfillState, "generation" | "actorRevisions"> & {attempts: Map<string, number>, completeInitialRun: boolean, signal?: AbortSignal}} ActressProfileBackfillProgress */

/** @param {string | null} [generation] @returns {ActressProfileBackfillState} */
export function createActressProfileBackfillState(generation = null) {
    return { schema: SCHEMA, generation, initialized: false, entries: {}, actorRevisions: {} };
}

/** @param {any} value */
export function hasFutureActressProfileBackfillSchema(value) {
    return value?.schema > SCHEMA;
}

/** @param {any} value @returns {ActressProfileBackfillState} */
export function readActressProfileBackfillState(value) {
    if (hasFutureActressProfileBackfillSchema(value)) {
        throw new Error("演员资料补齐记录来自更新版本");
    }
    return value?.schema === SCHEMA ? value : createActressProfileBackfillState();
}
