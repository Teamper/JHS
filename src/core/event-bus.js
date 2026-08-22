class JhsEventBus {
    constructor(channelName = "channel-refresh") {
        this.originId = globalThis.crypto?.randomUUID?.() || `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.listeners = new Map, this.seen = new Set, this.channel = new BroadcastChannel(channelName);
        this.channel.addEventListener("message", (event => this._receive(event.data)));
    }
    on(type, handler) {
        const handlers = this.listeners.get(type) || new Set;
        return handlers.add(handler), this.listeners.set(type, handlers), () => handlers.delete(handler);
    }
    async _dispatch(event) {
        for (const handler of [ ...(this.listeners.get(event.type) || []) ]) await handler(event.payload, event);
    }
    _remember(eventId) {
        this.seen.add(eventId), this.seen.size > 256 && this.seen.delete(this.seen.values().next().value);
    }
    async emit(type, payload = {}, options = {}) {
        const event = { eventId: globalThis.crypto?.randomUUID?.() || `event_${Date.now()}_${Math.random().toString(36).slice(2)}`, originId: this.originId, type, payload, timestamp: Date.now() };
        this._remember(event.eventId), await this._dispatch(event), !1 !== options.broadcast && this.channel.postMessage(event);
        return event;
    }
    async _receive(event) {
        if (!event || event.originId === this.originId || event.eventId && this.seen.has(event.eventId)) return;
        if (!event.eventId) {
            const legacyType = "refresh" === event.type ? "legacy-refresh" : event.type;
            return this._dispatch({ ...event, type: legacyType, payload: event.payload || {}, eventId: `legacy_${Date.now()}_${Math.random()}`, originId: "legacy", timestamp: Date.now() });
        }
        this._remember(event.eventId), await this._dispatch(event);
    }
}

const jhsEventBus = unsafeWindow.jhsEventBus = window.jhsEventBus = new JhsEventBus;
const G = jhsEventBus.channel;

window.refresh = () => jhsEventBus.emit("legacy-refresh");
window.cleanCache_filter_actor_actress_car_list = () => jhsEventBus.emit("blacklist-rules-changed");
window.clean_cacheSettingObj = () => jhsEventBus.emit("settings-changed");
