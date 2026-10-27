// @ts-check

const KEY = "jhs_new_video_source_health_v1";
export const ACTOR_SOURCE_RETRY_MS = 24 * 60 * 60 * 1000;

/** Local scan progress only: never changes an actress or her saved works. */
export class ActorSourceHealth {
    /** @param {{getLocal: (key: string) => any, setLocal: (key: string, value: string) => any}} storage @param {() => number} [clock] */
    constructor(storage, clock = () => Date.now()) { this.storage = storage; this.clock = clock; }
    read() {
        const raw = this.storage.getLocal(KEY);
        if (!raw) return {};
        const record = JSON.parse(raw);
        if (record.schema !== 1 || !record.entries || typeof record.entries !== "object" || Array.isArray(record.entries)) throw new Error("演员来源检测状态无效，请更新脚本后重试");
        return record.entries;
    }
    /** @param {string} baseUrl @param {string} starId */
    id(baseUrl, starId) { return `${new URL(baseUrl).origin}/actors/${encodeURIComponent(starId)}`; }
    /** @param {string} baseUrl */
    list(baseUrl) { const origin = new URL(baseUrl).origin; return Object.values(this.read()).filter((/** @type {any} */ item) => item.origin === origin); }
    /** @param {string} baseUrl @param {string} starId */
    isDeferred(baseUrl, starId) { return Number(this.read()[this.id(baseUrl, starId)]?.retryAt) > this.clock(); }
    /** @param {string} baseUrl @param {{starId: string, name: string}} actress */
    unavailable(baseUrl, actress) {
        const entries = this.read();
        entries[this.id(baseUrl, actress.starId)] = { origin: new URL(baseUrl).origin, starId: actress.starId, name: actress.name, code: "NOT_FOUND", failedAt: this.clock(), retryAt: this.clock() + ACTOR_SOURCE_RETRY_MS };
        this.storage.setLocal(KEY, JSON.stringify({ schema: 1, entries }));
    }
    /** @param {string} baseUrl @param {string} starId */
    clear(baseUrl, starId) {
        const entries = this.read(), id = this.id(baseUrl, starId);
        if (!Object.hasOwn(entries, id)) return;
        delete entries[id]; this.storage.setLocal(KEY, JSON.stringify({ schema: 1, entries }));
    }
}

/** @param {any} error */
export function isMissingActorSource(error) { return error?.code === "NOT_FOUND" || error?.details?.status === 404 || error?.status === 404; }
