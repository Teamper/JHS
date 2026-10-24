// @ts-check

/** Coordinate new automatic batches; never wait for quiet while a storage lock is held. */
export class BackgroundWork {
    /** @param {any} options */
    constructor(options) {
        this.document = options.document;
        this.clock = options.clock ?? (() => performance.now());
        this.readyAt = null;
        this.lastInput = 0;
        this.disposed = false;
        /** @type {any[]} */ this.waiters = [];
        /** @type {ReturnType<typeof setTimeout> | null} */ this.timer = null;
        const input = () => { this.lastInput = this.clock(); this.pump(); };
        for (const event of ["pointerdown", "mousemove", "keydown", "wheel", "scroll"]) options.scope.listen(this.document, event, input, { capture: true, passive: true });
        options.scope.listen(this.document, "visibilitychange", () => this.pump());
        options.scope.addCleanup(() => this.dispose());
    }
    markReady() { if (this.readyAt === null) this.readyAt = this.clock(); this.pump(); }
    /** @param {{signal?: AbortSignal, allowHidden?: boolean}} [options] */
    waitForTurn(options = {}) {
        if (this.disposed || options.signal?.aborted) return Promise.reject(new DOMException("后台任务已取消", "AbortError"));
        return new Promise((resolve, reject) => {
            const waiter = { ...options, resolve, reject, abort: () => {} };
            waiter.abort = () => { this.waiters = this.waiters.filter(item => item !== waiter); reject(new DOMException("后台任务已取消", "AbortError")); this.pump(); };
            options.signal?.addEventListener("abort", waiter.abort, { once: true });
            this.waiters.push(waiter); this.pump();
        });
    }
    /** Promote the operation already requested explicitly, without waking other automatic work. @param {AbortSignal} signal */
    expedite(signal) {
        const index = this.waiters.findIndex(waiter => waiter.signal === signal);
        if (index < 0) return;
        const waiter = this.waiters.splice(index, 1)[0];
        waiter.signal?.removeEventListener("abort", waiter.abort);
        waiter.resolve(); this.pump();
    }
    pump() {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        if (this.disposed || this.readyAt === null || !this.waiters.length) return;
        const index = this.waiters.findIndex(waiter => !this.document?.hidden || waiter.allowHidden);
        if (index < 0) return;
        const delay = Math.max(this.readyAt + 2000, this.lastInput + 500) - this.clock();
        if (delay > 0) { this.timer = setTimeout(() => { this.timer = null; this.pump(); }, delay); return; }
        const waiter = this.waiters.splice(index, 1)[0];
        waiter.signal?.removeEventListener("abort", waiter.abort);
        waiter.resolve();
        if (this.waiters.length) this.timer = setTimeout(() => { this.timer = null; this.pump(); }, 0);
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        for (const waiter of this.waiters.splice(0)) {
            waiter.signal?.removeEventListener("abort", waiter.abort);
            waiter.reject(new DOMException("后台任务已取消", "AbortError"));
        }
    }
}
