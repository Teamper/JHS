// @ts-check

/** Registry for resource-compatible offline providers and short-lived availability results. */
export class OfflineProviderRegistry {
    constructor() {
        /** @type {Map<string, any>} */ this.providers = new Map();
        /** @type {Map<string, {time:number,value:any}>} */ this.availabilityCache = new Map();
        /** @type {string[]} */ this.unavailableReasons = [];
        this.positiveTtl = 300000;
        this.negativeTtl = 20000;
    }

    /** @param {any} provider */
    register(provider) {
        if (!provider?.id || !Array.isArray(provider.capabilities) || typeof provider.submit !== "function" || typeof provider.getAvailability !== "function") {
            throw new TypeError("Invalid offline provider");
        }
        this.providers.set(provider.id, provider);
        return provider;
    }

    /** @param {string} resource @param {{force?:boolean}} [options] */
    async getCandidates(resource, { force = false } = {}) {
        const type = /^ed2k:/i.test(resource) ? "ed2k" : /^magnet:/i.test(resource) ? "magnet" : "unknown";
        const candidates = [];
        const reasons = [];
        for (const provider of this.providers.values()) {
            if (!provider.capabilities.includes(type)) {
                reasons.push(`${provider.name}：不支持 ${type === "unknown" ? "该资源格式" : type.toUpperCase()}`);
                continue;
            }
            if (!await provider.isEnabled()) {
                reasons.push(`${provider.name}：未启用`);
                continue;
            }
            const availability = await this.getAvailability(provider, force);
            if (["ready", "unknown"].includes(availability.authState)) candidates.push({ provider, availability });
            else reasons.push(`${provider.name}：${availability.reason || "授权不可用"}`);
        }
        this.unavailableReasons = reasons;
        return candidates;
    }

    getUnavailableReason() {
        const reasons = [...this.unavailableReasons];
        if (!this.providers.has("123")) reasons.unshift("123 云盘：授权桥接插件未加载或已禁用");
        return reasons.join("；") || "离线服务插件未加载或已禁用";
    }

    /** @param {any} provider @param {boolean} [force] */
    async getAvailability(provider, force = false) {
        const cached = this.availabilityCache.get(provider.id);
        const ttl = cached && ["ready", "unknown"].includes(cached.value.authState) ? this.positiveTtl : this.negativeTtl;
        if (!force && cached && Date.now() - cached.time < ttl) return cached.value;
        const value = await provider.getAvailability({ force });
        this.availabilityCache.set(provider.id, { time: Date.now(), value });
        return value;
    }

    /** @param {string} id @param {any} value */
    updateAvailability(id, value) { this.availabilityCache.set(id, { time: Date.now(), value }); }
}
