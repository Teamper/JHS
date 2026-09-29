// @ts-check

/**
 * Hosts the narrow 6.5.1 lookup surface while FeatureRuntime owns all behavior.
 * This registry deliberately has no plugin registration or execution pipeline.
 */
export class CompatibilityBeanRegistry {
    /** @param {{ diagnostics?: any }} [options] */
    constructor(options = {}) {
        /** @type {Map<string, any>} */ this.compatibilityBeans = new Map();
        /** @type {Map<string, {name: string, disableable: boolean}>} */ this._catalogDescriptors = new Map();
        /** @type {Array<Record<string, string>>} */ this._errorLog = [];
        this.diagnostics = options.diagnostics ?? null;
        this._syncDiagnostics();
    }

    /** @param {string} name @param {any} bean */
    registerCompatibilityBean(name, bean) {
        if (!name || !bean || this.compatibilityBeans.has(name)) throw new Error(`兼容 Bean 重复或无效: ${name}`);
        this.compatibilityBeans.set(name, bean);
    }

    /** @param {string} name @param {any} bean */
    unregisterCompatibilityBean(name, bean) {
        if (this.compatibilityBeans.get(name) !== bean) return false;
        return this.compatibilityBeans.delete(name);
    }

    /** Resolve a named compatibility capability from internal Feature wiring. @param {string} name */
    lookupCompatibilityBean(name) { return this.compatibilityBeans.get(name); }

    /** Preserve the historical external lookup used by integrations and browser tooling. @param {string} name */
    getBean(name) { return this.lookupCompatibilityBean(name); }

    /** @param {Array<{name: string, disableable: boolean}>} descriptors */
    setCatalogDescriptors(descriptors) {
        this._catalogDescriptors = new Map(descriptors.map((item) => [item.name, Object.freeze({ ...item })]));
        this._syncDiagnostics();
    }

    getPluginNames() { return []; }
    getPluginDescriptors() { return [...this._catalogDescriptors.values()].map((item) => ({ ...item })); }
    getTimings() { return []; }
    getCssTimings() { return []; }
    getErrorLog() { return this._errorLog.map((item) => ({ ...item })); }
    clearErrorLog() { this._errorLog = []; }

    getStartupReport() {
        return {
            registeredPlugins: 0,
            registrationMs: 0,
            cssMs: 0,
            immediateMs: 0,
            readyMs: 0,
            idlePending: 0,
            idleCompleted: 0,
        };
    }

    _syncDiagnostics() {
        this.diagnostics?.setLegacyRuntime(this.getPluginDescriptors(), this.getStartupReport(), this.getTimings());
    }
}
