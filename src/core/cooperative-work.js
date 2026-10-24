// @ts-check

/** Fair task boundary: boosted scheduler.yield continuations can starve host timers. */
export function yieldToMain() {
    if (typeof MessageChannel === "function") return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(undefined); };
        channel.port2.postMessage(null);
    });
    const scheduler = /** @type {any} */ (globalThis).scheduler;
    if (scheduler?.yield) return scheduler.yield();
    return new Promise(resolve => setTimeout(resolve, 0));
}

/** Drive the same pure steps synchronously for existing callers. @param {Generator<void, any, unknown>} steps */
export function finishComputation(steps) {
    for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

/** Budgets apply inside a record, not only between whole-library phases. */
export class ComputationBudget {
    /** @param {any} [options] */
    constructor(options = {}) {
        this.clock = options.clock ?? (() => performance.now());
        this.yieldTask = options.yieldTask ?? yieldToMain;
        this.signal = options.signal;
        this.diagnostics = options.diagnostics;
        this.milliseconds = options.milliseconds ?? 4;
    }
    assertActive() { if (this.signal?.aborted) throw new DOMException("计算已取消", "AbortError"); }
    /** @param {string} phase @param {Generator<void, any, unknown>} steps */
    async run(phase, steps) {
        this.assertActive();
        let start = this.clock(), total = 0, maximum = 0, count = 0, yields = 0;
        const record = () => { const elapsed = this.clock() - start; total += elapsed; maximum = Math.max(maximum, elapsed); };
        try {
            for (;;) {
                const next = steps.next();
                if (next.done) { record(); return next.value; }
                if (++count % 32 || this.clock() - start < this.milliseconds) continue;
                record(); yields++;
                await this.yieldTask(); this.assertActive(); start = this.clock();
            }
        } finally {
            steps.return(undefined);
            this.diagnostics?.recordComputation?.(phase, { cpuMs: total, maxSliceMs: maximum, steps: count, yields });
        }
    }
}

/** @param {any} options */
export function computationBudget(options) { return options instanceof ComputationBudget ? options : new ComputationBudget(options); }

const CLONE_OMIT = Symbol("JSON omitted property");
/** @param {any} value @param {Set<any>} [ancestors] @param {string} [key] @param {boolean} [root] @returns {Generator<void, any, unknown>} */
export function* jsonCloneSteps(value, ancestors = new Set(), key = "", root = true) {
    yield;
    if (value && typeof value.toJSON === "function") {
        value = value.toJSON(key);
        if (root && value === undefined) return JSON.parse(/** @type {any} */ (undefined));
    }
    if (!root && (value === undefined || typeof value === "function" || typeof value === "symbol")) return CLONE_OMIT;
    if (value == null || typeof value !== "object" || !Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return value == null ? value : JSON.parse(JSON.stringify(value));
    if (ancestors.has(value)) throw new TypeError("Converting circular structure to JSON");
    ancestors.add(value);
    const array = Array.isArray(value), result = /** @type {any} */ (array ? [] : {});
    for (const name of array ? Array.from({ length: value.length }, (_, i) => String(i)) : Object.keys(value)) {
        const copy = yield* jsonCloneSteps(value[name], ancestors, name, false);
        if (array) result.push(copy === CLONE_OMIT ? null : copy);
        else if (copy !== CLONE_OMIT) Object.defineProperty(result, name, { value: copy, enumerable: true, writable: true, configurable: true });
        yield;
    }
    ancestors.delete(value);
    return result;
}
