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
        /** @type {Map<string, Promise<Record<string, any>>>} */
        this.activations = new Map();
        this.commands.setActivator((featureId) => this.activate(featureId).then(() => undefined));
    }

    /** @param {Record<string, any>} manifest */
    register(manifest) {
        const validated = /** @type {Record<string, any>} */ (defineFeature(manifest));
        if (this.manifests.has(validated.id)) throw new Error(`Duplicate feature: ${validated.id}`);
        this.manifests.set(validated.id, validated);
        for (const command of validated.providesCommands) this.commands.registerOwner(command, validated.id);
    }

    /** @param {Record<string, any>} manifest */
    isEligible(manifest) {
        if (manifest.kind !== "system" && this.disabled.has(manifest.id)) return false;
        if (manifest.sites.length && !manifest.sites.includes(this.site)) return false;
        if (manifest.routes.length && !manifest.routes.includes(this.route)) return false;
        return true;
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
            const result = await manifest.activate(dependencies, Object.freeze({ scope, enabledContributions }));
            for (const command of manifest.providesCommands) {
                const handler = result?.commands?.[command];
                if (typeof handler !== "function") throw new Error(`Feature ${manifest.id} did not provide command ${command}`);
                this.commands.registerHandler(command, handler, manifest.id);
            }
            this.diagnostics.setFeature(manifest.id, true);
            enabledContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContribution(id, true));
            this.diagnostics.recordStartup(manifest.id, performance.now() - started);
            return Object.freeze({ manifest, scope, enabledContributions, dispose: () => {
                result?.dispose?.();
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
        for (const manifest of this.manifests.values()) {
            if (!this.isEligible(manifest)) continue;
            if (manifest.startup === "eager") await this.activate(manifest.id);
            else if (manifest.startup === "idle") {
                const schedule = globalThis.requestIdleCallback ?? ((callback) => setTimeout(callback, 0));
                schedule(() => void this.activate(manifest.id).catch(() => undefined));
            }
        }
    }

    getActiveFeatureIds() { return [...this.activations.keys()]; }
}
