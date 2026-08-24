// @ts-check

export class LifecycleScope {
    /** @param {string} id @param {{onChange?: (snapshot: ReturnType<LifecycleScope["snapshot"]>) => void}} [options] */
    constructor(id, options = {}) {
        if (!id) throw new TypeError("LifecycleScope id is required");
        this.id = id;
        this.controller = new AbortController();
        this.cleanups = new Set();
        this.requestConsumers = new Set();
        this.listenerCount = 0;
        this.observerCount = 0;
        this.disposed = false;
        this.generation = 0;
        this.onChange = options.onChange ?? null;
    }

    get signal() { return this.controller.signal; }

    /** @param {EventTarget} target @param {string} type @param {EventListenerOrEventListenerObject} listener @param {AddEventListenerOptions | boolean} [options] */
    listen(target, type, listener, options) {
        this.assertActive();
        target.addEventListener(type, listener, options);
        this.listenerCount += 1;
        return this.addCleanup(() => {
            target.removeEventListener(type, listener, options);
            this.listenerCount -= 1;
        });
    }

    /** @param {{disconnect: () => void}} observer */
    ownObserver(observer) {
        this.assertActive();
        this.observerCount += 1;
        return this.addCleanup(() => {
            observer.disconnect();
            this.observerCount -= 1;
        });
    }

    /** @param {number} timerId */
    ownTimeout(timerId) {
        return this.addCleanup(() => clearTimeout(timerId));
    }

    /** @param {{release: () => void}} consumer */
    ownRequestConsumer(consumer) {
        this.assertActive();
        this.requestConsumers.add(consumer);
        this.emitChange();
        return this.addCleanup(() => {
            if (!this.requestConsumers.delete(consumer)) return;
            consumer.release();
        });
    }

    /** @param {() => void} cleanup */
    addCleanup(cleanup) {
        this.assertActive();
        let active = true;
        const wrapped = () => {
            if (!active) return;
            active = false;
            this.cleanups.delete(wrapped);
            cleanup();
            this.emitChange();
        };
        this.cleanups.add(wrapped);
        this.emitChange();
        return wrapped;
    }

    nextGeneration() {
        this.assertActive();
        this.generation += 1;
        return this.generation;
    }

    /** @param {number} generation */
    canCommit(generation) {
        return !this.disposed && generation === this.generation;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.controller.abort();
        for (const cleanup of [...this.cleanups].reverse()) cleanup();
        this.emitChange();
    }

    assertActive() {
        if (this.disposed) throw new DOMException(`LifecycleScope ${this.id} is disposed`, "AbortError");
    }

    snapshot() {
        return Object.freeze({ id: this.id, disposed: this.disposed, listeners: this.listenerCount, observers: this.observerCount, requestConsumers: this.requestConsumers.size, generation: this.generation });
    }

    emitChange() { this.onChange?.(this.snapshot()); }
}
