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
        /** @type {Map<string, Record<string, any>>} */
        this.manifests = new Map();
        /** @type {Map<string, string>} */
        this.contributionOwners = new Map();
        /** @type {Map<string, Promise<Record<string, any>>>} */
        this.activations = new Map();
        this.commands.setActivator((featureId) => this.activate(featureId).then(() => undefined));
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
        for (const contributionId of validated.contributes) {
            const state = this.disabled.has(validated.id) || this.disabled.has(contributionId)
                ? "disabled"
                : this.isEligible(validated) ? "inactive" : "skipped";
            this.diagnostics.setContributionState(contributionId, state);
        }
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

    /** Return whether one contribution is enabled in its owning Feature. */
    /** @param {string} featureId @param {string} contributionId */
    isContributionEnabled(featureId, contributionId) {
        const manifest = this.manifests.get(featureId);
        if (!manifest || !manifest.contributes.includes(contributionId)) return false;
        // Cross-route owners (for example list.fc2-navigation using detail.fc2-owned)
        // need the contribution's site/disable state without requiring the owner
        // Feature itself to be eligible for the current route.
        const siteEligible = !manifest.sites.length || manifest.sites.includes(this.site);
        return siteEligible && !this.disabled.has(featureId) && !this.disabled.has(contributionId);
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

    /** Run one contribution through the authoritative lifecycle state machine. */
    /** @param {string} contributionId @param {() => any} operation */
    async runContribution(contributionId, operation) {
        const owner = this.contributionOwners.get(contributionId);
        if (this.disabled.has(contributionId) || owner && this.disabled.has(owner)) {
            this.diagnostics.setContributionState(contributionId, "disabled");
            return null;
        }
        this.diagnostics.setContributionState(contributionId, "starting");
        try {
            const result = await operation();
            this.diagnostics.setContributionState(contributionId, "active");
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.diagnostics.setContributionState(contributionId, "degraded", message);
            this.diagnostics.recordError({ source: "feature-runtime", contribution: contributionId, phase: "activate", status: "degraded", message });
            return null;
        }
    }

    /** Backward-compatible name for feature-owned controllers. */
    /** @param {string} contributionId @param {() => any} operation */
    async isolateContribution(contributionId, operation) { return this.runContribution(contributionId, operation); }

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
            enabledContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContributionState(id, "inactive"));
            const result = await manifest.activate(dependencies, Object.freeze({
                scope, enabledContributions, route: this.route,
                isContributionEnabled: (/** @type {string} */ featureId, /** @type {string} */ contributionId) => this.isContributionEnabled(featureId, contributionId),
                runContribution: (/** @type {string} */ contributionId, /** @type {() => any} */ operation) => this.runContribution(contributionId, operation),
                isolateContribution: (/** @type {string} */ contributionId, /** @type {() => any} */ operation) => this.isolateContribution(contributionId, operation),
            }));
            for (const command of manifest.providesCommands) {
                const handler = result?.commands?.[command];
                if (typeof handler !== "function") throw new Error(`Feature ${manifest.id} did not provide command ${command}`);
                this.commands.registerHandler(command, handler, manifest.id);
            }
            this.diagnostics.setFeature(manifest.id, true);
            this.diagnostics.setFeatureState(manifest.id, "active");
            enabledContributions.forEach((/** @type {string} */ id) => {
                if (this.diagnostics.getContributionState(id) === "inactive") this.diagnostics.setContributionState(id, "skipped");
            });
            this.diagnostics.recordStartup(manifest.id, performance.now() - started);
            return Object.freeze({ manifest, scope, enabledContributions, api: result?.api ?? null, dispose: () => {
                result?.dispose?.();
                scope.dispose();
                this.diagnostics.setFeature(manifest.id, false);
                this.diagnostics.setFeatureState(manifest.id, "inactive");
                enabledContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContributionState(id, "inactive"));
                this.activations.delete(manifest.id);
            } });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            manifest.contributes
                .filter((/** @type {string} */ id) => !this.disabled.has(id) && this.diagnostics.getContributionState(id) === "inactive")
                .forEach((/** @type {string} */ id) => this.diagnostics.setContributionState(id, "degraded", message));
            scope.dispose();
            this.diagnostics.recordError(error);
            throw error;
        }
    }

    async start() {
        /** @type {Record<string, any>[]} */
        const eagerManifests = [];
        const idleManifests = [];
        for (const manifest of this.manifests.values()) {
            if (!this.isEligible(manifest)) continue;
            if (manifest.startup === "eager") eagerManifests.push(manifest);
            else if (manifest.startup === "idle") idleManifests.push(manifest);
        }
        const outcomes = await Promise.allSettled(eagerManifests.map((manifest) => this.activate(manifest.id)));
        const fatalFailure = outcomes.find((outcome, index) => outcome.status === "rejected" && eagerManifests[index].failurePolicy === "fatal");
        outcomes.forEach((outcome, index) => {
            if (outcome.status !== "rejected") return;
            const manifest = eagerManifests[index];
            const message = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
            const state = manifest.failurePolicy === "fatal" ? "failed" : "degraded";
            this.diagnostics.setFeature(manifest.id, false);
            this.diagnostics.setFeatureState(manifest.id, state, message);
            this.diagnostics.recordError({ source: "feature-runtime", feature: manifest.id, phase: "start", status: state, message });
        });
        if (fatalFailure?.status === "rejected") throw fatalFailure.reason;
        const schedule = globalThis.requestIdleCallback ?? ((callback) => setTimeout(callback, 0));
        idleManifests.forEach((manifest) => schedule(() => void this.activate(manifest.id).catch(() => undefined)));
    }

    getActiveFeatureIds() { return [...this.activations.keys()]; }
}
