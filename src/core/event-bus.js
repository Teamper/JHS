// @ts-check

export class JhsEventBus {
    /** @param {string} [channelName] @param {{errorReporter?: (error: unknown) => void}} [options] */
    constructor(channelName = "channel-refresh", options = {}) {
        this.originId = globalThis.crypto?.randomUUID?.() || `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.listeners = new Map, this.seen = new Set, this.channel = new BroadcastChannel(channelName);
        this.errorReporter = options.errorReporter ?? null;
        /** @type {any[]} */ this.committed = [];
        this.committedScheduled = false;
        this.channel.addEventListener("message", (event => this._receive(event.data)));
    }
    /** @param {unknown} error */
    _reportHandlerError(error) {
        if (this.errorReporter) { try { this.errorReporter(error); } catch { /* never let reporting break dispatch */ } }
        else { try { /** @type {any} */ (globalThis).clog?.error?.("[JHS] event listener failed:", error); } catch { /* ignore */ } }
    }
    /** @param {string} type @param {(payload: any, event: any) => unknown} handler */
    on(type, handler) {
        const handlers = this.listeners.get(type) || new Set;
        return handlers.add(handler), this.listeners.set(type, handlers), () => handlers.delete(handler);
    }
    /** @param {any} event */
    async _dispatch(event) {
        for (const handler of [ ...(this.listeners.get(event.type) || []) ]) {
            try { await handler(event.payload, event); }
            catch (error) { this._reportHandlerError(error); }
        }
    }
    /** @param {string} eventId */
    _remember(eventId) {
        this.seen.add(eventId), this.seen.size > 256 && this.seen.delete(this.seen.values().next().value);
    }
    /** @param {string} type @param {any} [payload] @param {{broadcast?: boolean, broadcastFirst?: boolean}} [options] */
    async emit(type, payload = {}, options = {}) {
        const event = { eventId: globalThis.crypto?.randomUUID?.() || `event_${Date.now()}_${Math.random().toString(36).slice(2)}`, originId: this.originId, type, payload, timestamp: Date.now() };
        this._remember(event.eventId);
        const broadcast = () => { if (options.broadcast !== false) this.channel.postMessage(event); };
        if (options.broadcastFirst) {
            try { broadcast(); } catch (error) { this._reportHandlerError(error); }
            await this._dispatch(event);
        } else {
            try { await this._dispatch(event); }
            finally { broadcast(); }
        }
        return event;
    }
    /** Broadcast durable changes before deferred, ordered local UI work. Existing emit callers still await their handlers.
     * @param {Array<{type: string, payload: any}>} notices */
    publishCommitted(notices) {
        for (const { type, payload } of notices) {
            const event = { eventId: globalThis.crypto?.randomUUID?.() || `event_${Date.now()}_${Math.random()}`, originId: this.originId, type, payload, timestamp: Date.now() };
            this._remember(event.eventId);
            try { this.channel.postMessage(event); } catch (error) { this._reportHandlerError(error); }
            this.committed.push(event);
        }
        if (!this.committed.length || this.committedScheduled) return;
        this.committedScheduled = true;
        setTimeout(() => { void this._drainCommitted(); }, 0);
    }
    async _drainCommitted() {
        try { while (this.committed.length) await this._dispatch(this.committed.shift()); }
        finally { this.committedScheduled = false; }
    }
    /** @param {any} event */
    async _receive(event) {
        if (!event || event.originId === this.originId || event.eventId && this.seen.has(event.eventId)) return;
        if (!event.eventId) {
            const legacyType = "refresh" === event.type ? "legacy-refresh" : event.type;
            return this._dispatch({ ...event, type: legacyType, payload: event.payload || {}, eventId: `legacy_${Date.now()}_${Math.random()}`, originId: "legacy", timestamp: Date.now() });
        }
        this._remember(event.eventId), await this._dispatch(event);
    }
}

/** @type {JhsEventBus | undefined} */
export let jhsEventBus;

export function initializeEventBus() {
    if (jhsEventBus) return jhsEventBus;
    jhsEventBus = new JhsEventBus();
    const runtimeWindow = /** @type {any} */ (window);
    runtimeWindow.refresh = () => jhsEventBus?.emit("legacy-refresh");
    runtimeWindow.cleanCache_filter_actor_actress_car_list = () => jhsEventBus?.emit("blacklist-rules-changed");
    runtimeWindow.clean_cacheSettingObj = () => jhsEventBus?.emit("settings-changed", { source: "legacy" });
    return jhsEventBus;
}
// @ts-check
