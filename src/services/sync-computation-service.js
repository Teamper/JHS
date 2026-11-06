// @ts-check
import { ComputationBudget } from "../core/cooperative-work.js";
import { runSyncJob, decodeReconciliation } from "../core/sync-computation-jobs.js";

const transportError = () => Object.assign(new Error("同步计算线程不可用"), { code: "SYNC_WORKER_UNAVAILABLE" });

/** One lazily created, lifecycle-owned computation thread. Storage remains with its caller. */
export class SyncComputation {
    /** @param {{createWorker?: () => any, diagnostics?: any, timeout?: number}} [options] */
    constructor(options = {}) {
        this.options = options;
        /** @type {any} */ this.worker = null;
        /** @type {Promise<any> | null} */ this.starting = null;
        /** @type {Map<number, {revision: any, resolve: (value: any) => void, reject: (error: any) => void}>} */ this.pending = new Map();
        this.sequence = 0;
        this.generation = 0;
        /** @type {{key: number, proofKey: string, model: any, data: any, eligible: any} | null} */ this.verified = null;
        /** @type {string | null} */ this.reconcileKey = null;
        this.disabled = false;
        this.disposed = false;
        /** @type {ReturnType<typeof setTimeout> | null} */ this.startTimer = null;
        /** @type {((error: any) => void) | null} */ this.startReject = null;
        this.tail = Promise.resolve();
    }
    async ensureWorker() {
        if (this.disposed || this.disabled || !this.options.createWorker) throw transportError();
        if (this.starting) return this.starting;
        this.starting = new Promise((resolve, reject) => {
            this.startReject = reject;
            const timer = setTimeout(() => { this.disable(); reject(transportError()); }, this.options.timeout ?? 2000);
            this.startTimer = timer;
            try {
                const worker = this.options.createWorker?.();
                if (!worker) throw transportError();
                this.worker = worker;
                worker.onmessage = (/** @type {any} */ event) => {
                    if (this.worker !== worker) return;
                    const message = event.data;
                    if (message?.ready === 1) { clearTimeout(timer); this.startTimer = null; this.startReject = null; resolve(worker); return; }
                    const request = this.pending.get(message?.id);
                    if (!request) return;
                    this.pending.delete(message.id);
                    if (JSON.stringify(request.revision) !== JSON.stringify(message.revision)) {
                        this.disable();
                        request.reject(new DOMException("同步计算结果已失效", "AbortError"));
                        return;
                    }
                    if (message.error) request.reject(Object.assign(new Error(message.error.message), { name: message.error.name, code: message.error.code }));
                    else {
                        for (const entry of message.computations ?? []) this.options.diagnostics?.recordComputation?.(entry.phase, entry.value);
                        for (const entry of message.work ?? []) this.options.diagnostics?.recordWork?.(entry.phase, entry.count);
                        request.resolve(message.value);
                    }
                };
                worker.onerror = worker.onmessageerror = () => {
                    if (this.worker !== worker) return;
                    clearTimeout(timer); this.disable(); reject(transportError());
                };
            } catch { clearTimeout(timer); this.disable(); reject(transportError()); }
        });
        return this.starting;
    }
    /** @param {boolean} [permanent] */
    disable(permanent = true) {
        this.disabled = permanent;
        if (this.startTimer) clearTimeout(this.startTimer);
        this.startTimer = null;
        this.startReject?.(transportError()); this.startReject = null;
        this.starting = null;
        this.worker?.terminate(); this.worker = null;
        this.verified = null;
        this.reconcileKey = null;
        for (const pending of this.pending.values()) pending.reject(transportError());
        this.pending.clear();
    }
    /** @param {string} job @param {any} payload @param {{signal?: AbortSignal, revision?: any, work?: ComputationBudget}} [options] */
    run(job, payload, { signal, revision, work } = {}) {
        const generation = this.generation;
        const assertActive = () => { if (this.disposed || generation !== this.generation || signal?.aborted) throw new DOMException("同步计算已取消", "AbortError"); };
        const execute = async () => {
            assertActive();
            try {
                const worker = await this.ensureWorker(); assertActive();
                const id = ++this.sequence;
                let requestPayload = payload;
                if (job === "reconcile" && payload.proofKey && payload.proofKey === this.reconcileKey) {
                    const { model, shadow, ...metadata } = payload.state;
                    requestPayload = { ...payload, state: metadata };
                }
                if (job === "verified") {
                    const cached = this.verified;
                    const reusable = cached && cached.proofKey === payload.proofKey && cached.model === payload.verifiedModel
                        && cached.data === payload.verifiedData && cached.eligible === payload.verifiedEligible;
                    requestPayload = reusable
                        ? { cacheKey: cached.key, data: payload.data, eligible: payload.eligible }
                        : { ...payload, cacheKey: id };
                }
                const result = await new Promise((resolve, reject) => {
                    this.pending.set(id, { revision: structuredClone(revision), resolve, reject });
                    try { worker.postMessage({ id, job, payload: requestPayload, revision }); }
                    catch { this.pending.delete(id); this.disable(); reject(transportError()); }
                });
                assertActive();
                if (job === "reconcile") this.reconcileKey = payload.proofKey ?? null;
                if (job === "verified" && result === true) this.verified = { key: requestPayload.cacheKey, proofKey: payload.proofKey, model: payload.verifiedModel, data: payload.verifiedData, eligible: payload.verifiedEligible };
                return job === "reconcile" ? decodeReconciliation(payload.state, result) : result;
            } catch (error) {
                assertActive();
                if (/** @type {any} */ (error)?.code !== "SYNC_WORKER_UNAVAILABLE") throw error;
                this.disable();
                const result = await runSyncJob(job, payload, work ?? new ComputationBudget({ signal, diagnostics: this.options.diagnostics }));
                assertActive();
                return result;
            }
        };
        const operation = this.tail.then(execute, execute);
        this.tail = operation.then(() => undefined, () => undefined);
        if (!signal) return operation;
        /** @type {() => void} */ let abort = () => {};
        const cancelled = new Promise((_, reject) => {
            abort = () => {
                this.cancel();
                reject(new DOMException("同步计算已取消", "AbortError"));
            };
            signal.addEventListener("abort", abort, { once: true });
            if (signal.aborted) abort();
        });
        return Promise.race([operation, cancelled]).finally(() => signal.removeEventListener("abort", abort));
    }
    cancel() { this.generation++; if (!this.disabled) this.disable(false); }
    dispose() { this.generation++; this.disposed = true; this.disable(); }
}
