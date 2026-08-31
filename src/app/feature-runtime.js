// @ts-check

import { LifecycleScope } from "../core/lifecycle-scope.js";
import { migrateDisabledPlugins } from "../core/legacy-plugin-contributions.js";
import { defineFeature } from "../contracts/manifests.js";

export { LEGACY_PLUGIN_CONTRIBUTION_MAP, migrateDisabledPlugins } from "../core/legacy-plugin-contributions.js";

export class FeatureRuntime {
    /** @param {{container: import("./dependency-container.js").DependencyContainer, commands: import("./command-registry.js").CommandRegistry, diagnostics: import("../services/diagnostics-service.js").DiagnosticsService, disabled?: string[], site?: string, route?: string, styles?: any}} options */
    constructor(options) {
        this.container = options.container;
        this.commands = options.commands;
        this.diagnostics = options.diagnostics;
        this.disabled = new Set(migrateDisabledPlugins(options.disabled));
        this.site = options.site ?? "unknown";
        this.route = options.route ?? "unknown";
        this.styles = options.styles ?? null;
        /** @type {Map<string, Record<string, any>>} */
        this.manifests = new Map();
        /** @type {Map<string, string>} */
        this.contributionOwners = new Map();
        /** @type {Map<string, Promise<Record<string, any>>>} */
        this.activations = new Map();
        /** @type {Map<string, LifecycleScope>} */
        this.contributionScopes = new Map();
        /** @type {((name: string) => any) | null} */
        this.legacyResolver = null;
        /** @type {any} */ this.legacyContributionRegistry = null;
        this.commands.setActivator((featureId) => this.activate(featureId).then(() => undefined));
    }

    /** @param {(name: string) => any} resolver */
    setLegacyResolver(resolver) {
        if (typeof resolver !== "function") throw new TypeError("Legacy resolver must be a function");
        this.legacyResolver = resolver;
    }

    /** @param {any} registry */
    setLegacyContributionRegistry(registry) {
        this.legacyContributionRegistry = registry;
    }

    /** @param {Record<string, any>} manifest @param {readonly string[]} enabledContributions @param {LifecycleScope} scope */
    async mountLegacyStyles(manifest, enabledContributions, scope) {
        if (!this.styles?.register || !this.legacyContributionRegistry?.getFeaturePlugins) return;
        for (const { contributionId, plugin } of this.legacyContributionRegistry.getFeaturePlugins(manifest.id, enabledContributions)) {
            if (plugin.managedByFeature !== true || typeof plugin.initCss !== "function") continue;
            try {
                const css = await plugin.initCss();
                if (!css) continue;
                const normalizedCss = css.replace(/^\s*<style(?:\s[^>]*)?>/i, "").replace(/<\/style>\s*$/i, "");
                const styleId = `jhs-feature-${manifest.id}-${contributionId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
                const release = this.styles.register(styleId, normalizedCss);
                typeof release === "function" && scope.addCleanup(release);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.diagnostics.recordError({ source: "legacy-plugin", plugin: plugin.getName?.() || contributionId, phase: "initCss", message });
            }
        }
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

    /** Resolve an optional feature API without activating an ineligible feature. */
    /** @param {string} featureId */
    async getFeatureApi(featureId) {
        const manifest = this.manifests.get(featureId);
        if (!manifest || !this.isEligible(manifest)) return null;
        return (await this.activate(featureId)).api;
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
            const dependencies = this.container.resolveDeclared(manifest.requires);
            const enabledContributions = Object.freeze(manifest.contributes.filter((/** @type {string} */ id) => !this.disabled.has(id)));
            await this.mountLegacyStyles(manifest, enabledContributions, scope);
            const result = await manifest.activate(dependencies, Object.freeze({
                scope, enabledContributions, route: this.route,
                resolveLegacyContribution: (/** @type {string} */ contributionId) => this.legacyContributionRegistry?.getContributionPlugin?.(contributionId),
            }));
            const legacyApiAliases = manifest.legacyApiAliases ?? [];
            legacyApiAliases.forEach((/** @type {string} */ name) => this.legacyResolver?.(name)?.setFeatureApi?.(result?.api ?? null));
            for (const command of manifest.providesCommands) {
                const handler = result?.commands?.[command];
                if (typeof handler !== "function") throw new Error(`Feature ${manifest.id} did not provide command ${command}`);
                this.commands.registerHandler(command, handler, manifest.id);
            }
            this.diagnostics.setFeature(manifest.id, true);
            enabledContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContribution(id, true));
            this.diagnostics.recordStartup(manifest.id, performance.now() - started);
            return Object.freeze({ manifest, scope, enabledContributions, api: result?.api ?? null, dispose: () => {
                result?.dispose?.();
                legacyApiAliases.forEach((/** @type {string} */ name) => this.legacyResolver?.(name)?.setFeatureApi?.(null));
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
                enabledContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContribution(id, false));
                this.activations.delete(manifest.id);
            } });
        } catch (error) {
            scope.dispose();
            this.diagnostics.recordError(error);
            throw error;
        }
    }

    async start() {
        const eagerActivations = [];
        for (const manifest of this.manifests.values()) {
            if (!this.isEligible(manifest)) continue;
            if (manifest.startup === "eager") eagerActivations.push(this.activate(manifest.id));
            else if (manifest.startup === "idle") {
                const schedule = globalThis.requestIdleCallback ?? ((callback) => setTimeout(callback, 0));
                schedule(() => void this.activate(manifest.id).catch(() => undefined));
            }
        }
        await Promise.all(eagerActivations);
    }

    getActiveFeatureIds() { return [...this.activations.keys()]; }
}
