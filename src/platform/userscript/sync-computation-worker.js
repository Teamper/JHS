// @ts-check
import { ComputationBudget } from "../../core/cooperative-work.js";
import { runSyncJob, encodeReconciliation } from "../../core/sync-computation-jobs.js";

const workerScope = /** @type {any} */ (globalThis);
/** @type {{key: number, model: any, data: any, eligible: any} | null} */ let verified = null;
/** @type {{key: string, model: any, shadow: any} | null} */ let reconciliation = null;
workerScope.onmessage = async (/** @type {any} */ event) => {
    const { id, job, payload, revision } = event.data;
    /** @type {any[]} */ const computations = [];
    /** @type {any[]} */ const work = [];
    const diagnostics = {
        performanceRecording: true,
        recordComputation: (/** @type {string} */ phase, /** @type {any} */ value) => computations.push({ phase: `worker.${phase}`, value }),
        recordWork: (/** @type {string} */ phase, /** @type {number} */ count) => work.push({ phase, count }),
    };
    try {
        let input = payload;
        if (job === "reconcile" && !payload.state.model) {
            if (!reconciliation || reconciliation.key !== payload.proofKey) throw Object.assign(new Error("同步计算快照已失效"), { code: "SYNC_WORKER_UNAVAILABLE" });
            input = { ...payload, state: { ...payload.state, model: reconciliation.model, shadow: reconciliation.shadow } };
        }
        if (job === "verified" && !payload.verifiedModel) {
            if (!verified || payload.cacheKey !== verified.key) throw Object.assign(new Error("同步计算快照已失效"), { code: "SYNC_WORKER_UNAVAILABLE" });
            input = { ...payload, model: verified.model, verifiedModel: verified.model, verifiedData: verified.data, verifiedEligible: verified.eligible };
        }
        // The dedicated thread is terminated on cancellation. Only the main
        // thread fallback needs fair task boundaries between 4ms slices.
        const budget = new ComputationBudget({ diagnostics, milliseconds: Infinity });
        const value = await runSyncJob(job, input, budget);
        if (job === "reconcile" && payload.proofKey) reconciliation = { key: payload.proofKey, model: input.state.model, shadow: input.state.shadow };
        if (job === "verified" && value === true) verified = { key: payload.cacheKey, model: input.verifiedModel, data: input.verifiedData, eligible: input.verifiedEligible };
        const reply = job === "reconcile" ? await encodeReconciliation(input.state, value, budget) : value;
        workerScope.postMessage({ id, revision, value: reply, computations, work });
    } catch (error) {
        const failure = /** @type {any} */ (error);
        workerScope.postMessage({ id, revision, error: { name: failure.name, message: failure.message, code: failure.code } });
    }
};
workerScope.postMessage({ ready: 1 });
