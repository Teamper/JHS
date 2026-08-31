// @ts-check

/**
 * Holds legacy implementations that are still used as compatibility capabilities.
 * FeatureRuntime owns their lifecycle; this registry only constructs and resolves them.
 */
export class LegacyContributionRegistry {
    /** @param {{diagnostics?: any}} [options] */
    constructor(options = {}) {
        /** @type {Map<string, any>} */ this.plugins = new Map();
        /** @type {Map<string, {featureId: string, contributionId: string, plugin: any}>} */ this.contributions = new Map();
        /** @type {Readonly<Record<string, string[]>>} */ this._dependencyDeclarations = Object.freeze({});
        /** @type {Map<string, {name: string, disableable: boolean}>} */ this._catalogDescriptors = new Map();
        /** @type {((name: string) => any) | null} */ this._fallbackResolver = null;
        /** @type {Array<Record<string, any>>} */ this._errorLog = [];
        this._registrationMs = 0;
        this.diagnostics = options.diagnostics ?? null;
    }

    /** @param {Readonly<Record<string, string[]>>} declarations */
    setDependencyDeclarations(declarations) {
        if (this.plugins.size) throw new Error("依赖声明必须在插件注册前配置");
        this._dependencyDeclarations = declarations || Object.freeze({});
    }

    /** @param {Array<{name: string, disableable: boolean}>} descriptors */
    setCatalogDescriptors(descriptors) {
        if (this.plugins.size) throw new Error("插件目录必须在插件注册前配置");
        this._catalogDescriptors = new Map(descriptors.map((item) => [item.name, Object.freeze({ ...item })]));
    }

    /** @param {(name: string) => any} resolver */
    setFallbackResolver(resolver) {
        if (typeof resolver !== "function") throw new TypeError("Legacy fallback resolver must be a function");
        this._fallbackResolver = resolver;
    }

    /** @param {string} name @returns {any} */
    getOwnBean(name) { return this.plugins.get(name); }

    /** @param {string} name @returns {any} */
    getBean(name) { return this.plugins.get(name) ?? this._fallbackResolver?.(name); }

    /** @param {string} name @returns {any} */
    resolveDeclaredPlugin(name) { return this.plugins.get(name) ?? this._fallbackResolver?.(name); }

    /** @param {new (...args: any[]) => any} Plugin @param {Record<string, any>} [runtimeServices] @param {{disableable?: boolean, managedByFeature?: boolean}} [options] @param {{featureId?: string, contributionId?: string}} [contribution] */
    register(Plugin, runtimeServices = {}, options = {}, contribution = {}) {
        if (typeof Plugin !== "function") throw new Error("插件必须是一个类");
        const startedAt = performance.now();
        const plugin = new Plugin();
        plugin.pluginManager = this;
        const name = plugin.getName();
        if (this.plugins.has(name)) throw new Error(`插件"${name}"已注册`);
        plugin.declaredDependencies = new Set(this._dependencyDeclarations[name] || []);
        plugin.runtimeServices = Object.freeze({ ...runtimeServices });
        plugin.disableable = options.disableable ?? true;
        plugin.managedByFeature = options.managedByFeature === true;
        this.plugins.set(name, plugin);
        if (contribution.featureId && contribution.contributionId) {
            this.contributions.set(contribution.contributionId, Object.freeze({ featureId: contribution.featureId, contributionId: contribution.contributionId, plugin }));
        }
        this._registrationMs += performance.now() - startedAt;
    }

    /** @param {string} plugin @param {string} dependency @param {Error} error */
    recordDependencyError(plugin, dependency, error) {
        (/** @type {any} */ (error)).jhsDiagnosticsRecorded = true;
        this._errorLog.push({ plugin, dependency, message: error.message });
        this._errorLog.length > 200 && this._errorLog.shift();
        this.diagnostics?.recordError({ source: "legacy-plugin", plugin, phase: "dependency", message: error.message });
        return error;
    }

    getErrorLog() { return [...this._errorLog]; }
    clearErrorLog() { this._errorLog = []; }
    getPluginNames() { return [...this.plugins.keys()]; }
    getPluginDescriptors() {
        const descriptors = new Map(this._catalogDescriptors);
        for (const [name, plugin] of this.plugins) descriptors.set(name, Object.freeze({ name, disableable: plugin.disableable !== false }));
        return [...descriptors.values()];
    }
    getTimings() {
        return [...this.plugins].map(([name, plugin]) => ({
            name,
            elapsed: 0,
            status: plugin.managedByFeature === true ? "managed-feature" : "registered",
            startupMode: "feature",
        }));
    }
    getStartupReport() {
        return { registeredPlugins: this.plugins.size, registrationMs: this._registrationMs };
    }

    /** @param {string} featureId @param {readonly string[]} contributionIds */
    getFeaturePlugins(featureId, contributionIds) {
        return contributionIds.flatMap((contributionId) => {
            const contribution = this.contributions.get(contributionId);
            return contribution?.featureId === featureId ? [contribution] : [];
        });
    }
}
