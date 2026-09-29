// @ts-check

import { LifecycleScope } from "../core/lifecycle-scope.js";
import { migrateDisabledPlugins } from "../core/legacy-plugin-contributions.js";
import { defineFeature } from "../contracts/manifests.js";

export { LEGACY_PLUGIN_CONTRIBUTION_MAP, migrateDisabledPlugins } from "../core/legacy-plugin-contributions.js";

export class FeatureRuntime {
    /** @param {{container: import("./dependency-container.js").DependencyContainer, commands: import("./command-registry.js").CommandRegistry, diagnostics: import("../services/diagnostics-service.js").DiagnosticsService, disabled?: string[], site?: string, route?: string}} options */
    constructor(options) {
        this.container = options.container;
        this.commands = options.commands;
        this.diagnostics = options.diagnostics;
        this.disabled = new Set(migrateDisabledPlugins(options.disabled));
        this.site = options.site ?? "unknown";
        this.route = options.route ?? "unknown";
        /** @type {Map<string, Record<string, any>>} */
        this.manifests = new Map();
        /** @type {Map<string, string>} */
        this.contributionOwners = new Map();
        this.contributionManifests = new Map();
        /** @type {Map<string, Promise<Record<string, any>>>} */
        this.activations = new Map();
        /** @type {Map<string, LifecycleScope>} */
        this.contributionScopes = new Map();
        /** @type {Record<string, any>[]} */
        this.pendingIdleFeatures = [];
        this.idleFeaturesScheduled = false;
        /** @type {((name: string) => any) | null} */
        this.compatibilityBeanResolver = null;
        /** @type {((name: string, bean: any) => (() => void) | void) | null} */
        this.compatibilityBeanRegistrar = null;
        this.commands.setActivator((featureId) => this.activate(featureId).then(() => undefined));
    }

    /** @param {ReadonlyArray<Record<string, any>>} manifests */
    setContributionCatalog(manifests) { this.contributionManifests = new Map(manifests.map((item) => [item.id, item])); }

    /** @param {(name: string) => any} resolver */
    setCompatibilityBeanResolver(resolver) { this.compatibilityBeanResolver = resolver; }

    /** @param {(name: string, bean: any) => (() => void) | void} registrar */
    setCompatibilityBeanRegistrar(registrar) { this.compatibilityBeanRegistrar = registrar; }

    activeSurfaces() {
        if (this.route === "list") return new Set(["global", "list", "list-page", "list-card"]);
        if (this.route === "detail" || this.route === "owned-detail") return new Set(["global", "detail", "detail-page", this.route]);
        return new Set(["global", this.route]);
    }

    /** @param {Record<string, any>} manifest */
    register(manifest) {
        const validated = /** @type {Record<string, any>} */ (defineFeature(manifest));
        if (this.manifests.has(validated.id)) throw new Error(`Duplicate feature: ${validated.id}`);
        for (const contributionId of validated.contributes) {
            const owner = this.contributionOwners.get(contributionId);
            if (owner) throw new Error(`Duplicate contribution ownership: ${contributionId} (${owner}, ${validated.id})`);
        }
        this.manifests.set(validated.id, validated);
        for (const contributionId of validated.contributes) this.contributionOwners.set(contributionId, validated.id);
        for (const command of validated.providesCommands) {
            this.commands.registerOwner(command, validated.id);
            this.commands.setOwnerEnabled(command, this.isEligible(validated));
        }
    }

    /** @param {Record<string, any>} manifest */
    isEligible(manifest) {
        if (manifest.kind !== "system" && this.disabled.has(manifest.id)) return false;
        if (manifest.sites.length && !manifest.sites.includes(this.site)) return false;
        if (manifest.routes.length && !manifest.routes.includes(this.route)) return false;
        return true;
    }

    /** @param {string} featureId @param {string} contributionId @param {string} legacyPluginId */
    isContributionEnabled(featureId, contributionId, legacyPluginId) {
        const manifest = this.manifests.get(featureId);
        if (!manifest) return false;
        if (manifest.sites.length && !manifest.sites.includes(this.site)) return false;
        if (!manifest.contributes.includes(contributionId)) return false;
        if (manifest.kind !== "system" && this.disabled.has(manifest.id)) return false;
        if (manifest.kind === "system") return true;
        const contribution = this.contributionManifests.get(contributionId);
        if (contribution?.sites?.length && !contribution.sites.includes(this.site)) return false;
        if (contribution?.routes?.length && !contribution.routes.includes(this.route)) return false;
        if (contribution?.surfaces?.length && !contribution.surfaces.some((/** @type {string} */ surface) => this.activeSurfaces().has(surface))) return false;
        return !this.disabled.has(contributionId) && !this.disabled.has(legacyPluginId);
    }

    /** @param {string} featureId */
    isFeatureDisableable(featureId) {
        const manifest = this.manifests.get(featureId);
        if (!manifest) throw new Error(`Unknown feature: ${featureId}`);
        return manifest.kind !== "system" && manifest.disableable !== false;
    }

    /** @param {symbol[]} tokens */
    resolveDeclaredDependencies(tokens) {
        return this.container.resolveDeclared(tokens);
    }

    /** @param {string} featureId */
    async getScope(featureId) {
        return (await this.activate(featureId)).scope;
    }

    /** Return a page-lifetime scope owned by one enabled legacy contribution. @param {string} featureId @param {string} contributionId @param {string} legacyPluginId */
    getContributionScope(featureId, contributionId, legacyPluginId) {
        if (!this.isContributionEnabled(featureId, contributionId, legacyPluginId)) {
            return Promise.reject(new Error(`Contribution is disabled or ineligible: ${contributionId}`));
        }
        let scope = this.contributionScopes.get(contributionId);
        if (!scope || scope.disposed) {
            scope = new LifecycleScope(`contribution:${contributionId}`, { onChange: (snapshot) => this.diagnostics.updateScope(snapshot) });
            this.contributionScopes.set(contributionId, scope);
        }
        return Promise.resolve(scope);
    }

    /** @param {string} id */
    activate(id) {
        const existing = this.activations.get(id);
        if (existing) return existing;
        const manifest = this.manifests.get(id);
        if (!manifest) return Promise.reject(new Error(`Unknown feature: ${id}`));
        if (!this.isEligible(manifest)) return Promise.reject(new Error(`Feature is disabled or ineligible: ${id}`));
        const activation = this.activateManifest(manifest);
        this.activations.set(id, activation);
        activation.catch(() => this.activations.delete(id));
        return activation;
    }

    /** @param {Record<string, any>} manifest */
    async activateManifest(manifest) {
        const started = performance.now();
        const scope = new LifecycleScope(`feature:${manifest.id}`, { onChange: (snapshot) => this.diagnostics.updateScope(snapshot) });
        try {
            const requiredFeatures = manifest.requiresFeaturesByRoute?.[this.route] ?? [];
            if (!Array.isArray(requiredFeatures)) throw new TypeError(`Feature ${manifest.id} has invalid route dependencies for ${this.route}`);
            for (const featureId of requiredFeatures) await this.activate(featureId);
            const dependencies = this.container.resolveDeclared(manifest.requires, manifest.optionalRequires ?? []);
            const enabledContributions = Object.freeze(manifest.contributes.filter((/** @type {string} */ id) => {
                const contribution = this.contributionManifests.get(id);
                return this.isContributionEnabled(manifest.id, id, contribution?.legacyPluginId || id);
            }));
            const result = await manifest.activate(dependencies, Object.freeze({
                scope, enabledContributions, site: this.site, route: this.route,
                isContributionEnabled: (/** @type {string} */ featureId, /** @type {string} */ contributionId, /** @type {string} */ legacyPluginId = contributionId) => this.isContributionEnabled(featureId, contributionId, legacyPluginId),
                executeCommand: /** @type {(command: string, ...args: unknown[]) => Promise<unknown>} */ ((command, ...args) => this.commands.execute(command, ...args)),
                resolveCompatibilityBean: (/** @type {string} */ name) => this.compatibilityBeanResolver?.(name),
                registerCompatibilityBean: (/** @type {string} */ name, /** @type {any} */ bean) => this.compatibilityBeanRegistrar?.(name, bean),
                diagnostics: this.diagnostics,
            }));
            const activeContributions = Object.freeze(result?.activeContributions ?? enabledContributions);
            for (const command of manifest.providesCommands) {
                const handler = result?.commands?.[command];
                if (typeof handler !== "function") throw new Error(`Feature ${manifest.id} did not provide command ${command}`);
                this.commands.registerHandler(command, handler, manifest.id);
            }
            this.diagnostics.setFeature(manifest.id, true);
            activeContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContribution(id, true));
            this.diagnostics.recordStartup(manifest.id, performance.now() - started);
            return Object.freeze({ manifest, scope, enabledContributions: activeContributions, dispose: () => {
                result?.dispose?.();
                // 6.5: contribution scopes belong to the feature that owns their contribution ids;
                // disposing the feature must tear down those scopes too so listeners/observers/timers
                // do not leak across activate -> dispose -> activate cycles.
                for (const contributionId of manifest.contributes) {
                    const contributionScope = this.contributionScopes.get(contributionId);
                    if (contributionScope) {
                        contributionScope.dispose();
                        this.contributionScopes.delete(contributionId);
                    }
                }
                scope.dispose();
                this.diagnostics.setFeature(manifest.id, false);
                activeContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContribution(id, false));
                this.activations.delete(manifest.id);
            } });
        } catch (error) {
            scope.dispose();
            this.diagnostics.recordError(error);
            throw error;
        }
    }

    async start() {
        const eager = [];
        const idle = [];
        for (const manifest of this.manifests.values()) {
            if (!this.isEligible(manifest)) continue;
            if (manifest.startup === "eager") eager.push(manifest);
            else if (manifest.startup === "idle") idle.push(manifest);
        }
        // Independent eager Features must not serialize first-ready or leave work running after a failure.
        const results = await Promise.allSettled(eager.map((manifest) => this.activate(manifest.id)));
        const systemErrors = [];
        for (let index = 0; index < results.length; index += 1) {
            const result = results[index];
            if (result.status === "rejected" && eager[index].kind === "system") systemErrors.push(result.reason);
        }
        if (systemErrors.length) {
            for (const result of [...results].reverse()) {
                if (result.status !== "fulfilled") continue;
                try { result.value.dispose(); }
                catch (error) { this.diagnostics.recordError(error); }
            }
            if (systemErrors.length === 1) throw systemErrors[0];
            throw new AggregateError(systemErrors, "System Feature startup failed");
        }
        this.pendingIdleFeatures = idle;
    }

    scheduleIdle() {
        if (this.idleFeaturesScheduled) return;
        this.idleFeaturesScheduled = true;
        const features = this.pendingIdleFeatures.splice(0);
        for (const manifest of features) {
            const activate = () => {
                if (!this.isEligible(manifest)) return;
                void this.activate(manifest.id).catch(() => undefined);
            };
            if (typeof globalThis.requestIdleCallback === "function") globalThis.requestIdleCallback(activate, { timeout: 1500 });
            else setTimeout(activate, 100);
        }
    }

    getActiveFeatureIds() { return [...this.activations.keys()]; }
}
