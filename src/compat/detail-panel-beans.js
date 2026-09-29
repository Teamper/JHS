// @ts-check

/** Keeps the former ReviewPlugin service and panel methods without creating a runtime executor. */
export class ReviewCompatibilityBean {
    /** @param {{review: any, settings: any, storage: any, movie: any, host: any, showPanel: (...args: any[]) => Promise<any>, getScope: () => Promise<any>}} dependencies */
    constructor(dependencies) {
        this.dependencies = /** @type {Record<string, any>} */ (dependencies);
        this.managedByFeature = true;
    }

    /** @param {string} name */
    getRuntimeService(name) {
        if (name === "scope") return this.dependencies.getScope;
        return this.dependencies[name] ?? null;
    }

    /** @param {string} movieId @param {any} target @param {Record<string, unknown>} [options] */
    async showReview(movieId, target, options = {}) {
        return this.dependencies.showPanel(movieId, target, options);
    }
}

/** Keeps the former RelatedPlugin service and panel methods without a second mount executor. */
export class RelatedCompatibilityBean {
    /** @param {{related: any, settings: any, host: any, getScope: () => Promise<any>, jquery?: (value: any) => any, showPanel: (...args: any[]) => Promise<any>}} dependencies */
    constructor(dependencies) {
        this.dependencies = /** @type {Record<string, any>} */ (dependencies);
        this.managedByFeature = true;
    }

    /** @param {string} name */
    getRuntimeService(name) {
        if (name === "scope") return this.dependencies.getScope;
        return this.dependencies[name] ?? null;
    }

    /** @param {string} name */
    getHostedSlot(name) {
        const element = this.dependencies.host?.locateDetailSlots?.()?.[name];
        const jquery = this.dependencies.jquery ?? (/** @type {any} */ (globalThis).jQuery ?? (/** @type {any} */ (globalThis).$));
        return typeof jquery === "function" ? jquery(element ?? []) : null;
    }

    /** @param {any} target @param {string} movieId @param {Record<string, unknown>} [options] */
    async showRelated(target, movieId, options = {}) {
        return this.dependencies.showPanel(target?.length ? target : this.getHostedSlot("related"), movieId, options);
    }
}
