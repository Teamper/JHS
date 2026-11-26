// @ts-check
import { createRuntimeLookup } from "./runtime-lookup.js";
import { parseBooleanSetting } from "../core/feature-helpers.js";

import { LifecycleScope } from "../core/lifecycle-scope.js";
import { disabledIdForPlugin, parseDisabledPlugins } from "../core/legacy-plugin-contributions.js";
import { migrateDisabledPlugins } from "../core/legacy-plugin-contributions.js";
import { ENHANCEMENT_FEATURES, ENHANCEMENT_METADATA } from "../core/enhancement-controls.js";

export { LEGACY_PLUGIN_CONTRIBUTION_MAP, migrateDisabledPlugins } from "../core/legacy-plugin-contributions.js";

export class FeatureRuntime {
    /** @param {{container: import("./dependency-container.js").DependencyContainer, commands: import("./command-registry.js").CommandRegistry, diagnostics: import("../services/diagnostics-service.js").DiagnosticsService, backgroundWork?: any, disabled?: string[], site?: string, route?: string}} options */
    constructor(options) {
        this.backgroundWork = options.backgroundWork;
        /** @type {Record<string, unknown> | undefined} */ this.inspection = undefined;
        this.container = options.container;
        /** @type {Map<string, unknown>} */ this.capabilities = new Map();
        this.capabilityEvents = new EventTarget();
        this.commands = options.commands;
        this.diagnostics = options.diagnostics;
        this.disabled = new Set(migrateDisabledPlugins(options.disabled));

        this.configurationSnapshot = /** @type {Record<string, any>} */ ({});
        this.started = false;
        this.configurationRevision = 0;
        this.configurationQueue = Promise.resolve();
        /** @type {Map<string, LifecycleScope>} */
        this.activationScopes = new Map();
        this.site = options.site ?? "unknown";
        this.route = options.route ?? "unknown";
        /** @type {Map<string, Record<string, any>>} */
        this.manifests = new Map();
        /** @type {Map<string, string>} */
        this.contributionOwners = new Map();
        /** @type {Map<string, Promise<Record<string, any>>>} */
        this.activations = new Map();
        /** @type {Record<string, any>[]} */
        this.pendingIdleFeatures = [];
        this.idleFeaturesScheduled = false;
        this.runtimeLookup = createRuntimeLookup();
        this.commands.setActivator((featureId) => this.activate(featureId).then(() => undefined));
    }

    /** @param {Record<string, any>} manifest */
    register(manifest) {
        if (this.manifests.has(manifest.id)) throw new Error(`Duplicate feature: ${manifest.id}`);
        for (const contributionId of manifest.contributes) {
            const owner = this.contributionOwners.get(contributionId);
            if (owner) throw new Error(`Duplicate contribution ownership: ${contributionId} (${owner}, ${manifest.id})`);
        }
        this.manifests.set(manifest.id, manifest);
        for (const contributionId of manifest.contributes) this.contributionOwners.set(contributionId, manifest.id);
        for (const command of manifest.providesCommands) {
            this.commands.registerOwner(command, manifest.id);
            this.commands.setOwnerEnabled(command, this.isEligible(manifest));
        }
    }

    /** @param {Record<string, any>} manifest */
    isEligible(manifest) {
        if (manifest.kind !== "system" && this.disabled.has(manifest.id)) return false;

        if (manifest.id === "media-library" && !parseBooleanSetting(this.configurationSnapshot.enableMediaLibrary, false)) return false;
        if (manifest.sites.length && !manifest.sites.includes(this.site)) return false;
        if (manifest.routes.length && !manifest.routes.includes(this.route)) return false;
        const dependencies = manifest.requiresFeaturesByRoute?.[this.route] ?? [];
        if (dependencies.some((/** @type {string} */ id) => this.disabled.has(id))) return false;
        const metadata = /** @type {any} */ (ENHANCEMENT_METADATA)[manifest.id];
        if (metadata?.dependencies.some((/** @type {string} */ id) => {
            const owner = this.contributionOwners.get(id);
            return owner && !this.isContributionEnabled(owner, id);
        })) return false;
        return true;
    }

    /** @param {string} name */
    isCompatibilityBeanAvailable(name) {
        const id = disabledIdForPlugin(name), owner = this.contributionOwners.get(id);
        return !owner || this.isContributionEnabled(owner, id, name);
    }

    getFeatureDescriptors() {
        return Object.entries(ENHANCEMENT_METADATA).map(([id, metadata]) => {
            const details = /** @type {any} */ (metadata), owner = id === "subtitle115-upload" ? "subtitle-workspace" : id;
            const manifest = this.manifests.get(owner), enabled = details.settingKey ? parseBooleanSetting(this.configurationSnapshot[details.settingKey], true) : !this.disabled.has(id);
            const available = Boolean(enabled && manifest && this.isEligible(manifest));
            const active = available && this.activations.has(owner);
            const status = !enabled ? "已关闭" : !available ? "当前页面不可用" : active ? "运行中" : "按需启用";
            return { ...details, id, name: details.name || /** @type {Record<string, string>} */ (ENHANCEMENT_FEATURES)[id], disableable: true, sites: manifest?.sites || [], enabled, available, active, status };
        });
    }

    /** Apply persisted settings in order; block commands before asynchronous teardown. @param {any} snapshot */
    reconcileConfiguration(snapshot) {
        const mediaChanged = this.configurationSnapshot.enableMediaLibrary !== snapshot.enableMediaLibrary;
        this.configurationSnapshot = snapshot;
        const previous = this.disabled;
        this.disabled = new Set(migrateDisabledPlugins(parseDisabledPlugins(snapshot.disabledPlugins)));


        const revision = ++this.configurationRevision;
        const affected = new Set();
        for (const manifest of this.manifests.values()) {
            const contributionsChanged = [...manifest.contributes, ...(manifest.configurationDependencies || [])].some((/** @type {string} */ id) => previous.has(id) !== this.disabled.has(id));
            if (!this.isEligible(manifest) || contributionsChanged || mediaChanged && manifest.id === "media-library") affected.add(manifest.id);
            for (const command of manifest.providesCommands) this.commands.setOwnerEnabled(command, this.isEligible(manifest));
        }
        // Reattach consumers that hold an adapter from a restarting parent.
        let added;
        do {
            added = false;
            for (const manifest of this.manifests.values()) {
                if (!affected.has(manifest.id) && (manifest.requiresFeaturesByRoute?.[this.route] || []).some((/** @type {string} */ id) => affected.has(id))) {
                    affected.add(manifest.id);
                    added = true;
                }
            }
        } while (added);
        if (!this.started) return Promise.resolve();
        for (const id of affected) this.activationScopes.get(id)?.dispose();
        const apply = async () => {
            for (const id of affected) {
                try { (await this.activations.get(id))?.dispose(); } catch { /* Canceled activation has already cleaned its scope. */ }
            }
            if (revision !== this.configurationRevision) return;
            for (const manifest of this.manifests.values()) {
                if (this.isEligible(manifest) && manifest.startup !== "on-command" && manifest.startup !== "on-demand") {
                    try { await this.activate(manifest.id); } catch (error) { this.diagnostics.recordError(error); }
                }
            }
            this.diagnostics.featureDescriptors = this.getFeatureDescriptors();
            if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("jhs-feature-availability-changed"));
        };
        this.configurationQueue = this.configurationQueue.catch(() => {}).then(apply);
        return this.configurationQueue;
    }

    /** Check user disablement preference for a contribution regardless of current site/route gating. @param {string} featureId @param {string} contributionId @param {string} [legacyPluginId] */
    isContributionPreferenceEnabled(featureId, contributionId, legacyPluginId = contributionId) {
        const manifest = this.manifests.get(featureId);
        if (!manifest) return false;
        if (manifest.kind !== "system" && this.disabled.has(manifest.id)) return false;
        return !this.disabled.has(contributionId) && !this.disabled.has(legacyPluginId);
    }

    /** @param {string} featureId @param {string} contributionId @param {string} [legacyPluginId] */
    isContributionEnabled(featureId, contributionId, legacyPluginId = contributionId) {
        const manifest = this.manifests.get(featureId);
        if (!manifest) return false;
        if (manifest.sites.length && !manifest.sites.includes(this.site)) return false;
        if (!manifest.contributes.includes(contributionId)) return false;
        if (manifest.kind !== "system" && this.disabled.has(manifest.id)) return false;

        if (manifest.kind === "system") return true;
        const availability = manifest.contributionAvailability?.[contributionId];
        if (availability?.sites && !availability.sites.includes(this.site)) return false;
        const routes = availability?.routes ?? manifest.contributionRoutes;
        if (routes?.length && !routes.includes(this.route)) return false;
        return !this.disabled.has(contributionId) && !this.disabled.has(legacyPluginId);
    }

    /** @param {string} id */
    activate(id) {
        const manifest = this.manifests.get(id);
        if (!manifest) return Promise.reject(new Error(`Unknown feature: ${id}`));
        if (!this.isEligible(manifest)) return Promise.reject(new Error(`Feature is disabled or ineligible: ${id}`));
        const existing = this.activations.get(id);
        if (existing) return existing;
        const activation = this.activateManifest(manifest);
        this.activations.set(id, activation);
        activation.catch(() => { if (this.activations.get(id) === activation) this.activations.delete(id); });
        return activation;
    }

    /** @param {Record<string, any>} manifest */
    async activateManifest(manifest) {
        const started = performance.now();
        const scope = new LifecycleScope(`feature:${manifest.id}`, { onChange: (snapshot) => this.diagnostics.updateScope(snapshot) });
        this.activationScopes.set(manifest.id, scope);
        /** @type {Record<string, any> | undefined} */ let result;
        /** @type {readonly string[]} */ let activeContributions = [];
        /** @type {Array<() => void>} */ const releaseCommands = [];
        let disposed = false;
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            /** @type {unknown} */ let failure;
            const clean = (/** @type {() => void} */ operation) => {
                try { operation(); } catch (error) { failure ??= error; }
            };
            clean(() => result?.dispose?.());
            releaseCommands.splice(0).reverse().forEach((release) => clean(release));
            clean(() => scope.dispose());
            if (this.activationScopes.get(manifest.id) === scope) this.activationScopes.delete(manifest.id);
            this.activations.delete(manifest.id);
            clean(() => this.diagnostics.setFeature(manifest.id, false));
            activeContributions.forEach((id) => clean(() => this.diagnostics.setContribution(id, false)));
            if (failure) throw failure;
        };
        try {
            const requiredFeatures = manifest.requiresFeaturesByRoute?.[this.route] ?? [];
            for (const featureId of requiredFeatures) await this.activate(featureId);
            const dependencies = this.container.resolveDeclared(manifest.requires, manifest.optionalRequires ?? []);
            const enabledContributions = Object.freeze(manifest.contributes.filter((/** @type {string} */ id) => this.isContributionEnabled(manifest.id, id)));
            const inspection = this.inspection;
            result = await manifest.activate(dependencies, Object.freeze({
                scope, featureId: manifest.id, enabledContributions, site: this.site, route: this.route,
                isContributionEnabled: (/** @type {string} */ featureId, /** @type {string} */ contributionId, /** @type {string} */ legacyPluginId = contributionId) => this.isContributionEnabled(featureId, contributionId, legacyPluginId),
                isContributionPreferenceEnabled: (/** @type {string} */ featureId, /** @type {string} */ contributionId, /** @type {string} */ legacyPluginId = contributionId) => this.isContributionPreferenceEnabled(featureId, contributionId, legacyPluginId),
                executeCommand: /** @type {(command: string, ...args: unknown[]) => Promise<unknown>} */ ((command, ...args) => this.commands.execute(command, ...args)),
                isCommandAvailable: (/** @type {string} */ command) => this.commands.isAvailable(command),
                getCapability: (/** @type {string} */ id) => this.capabilities.get(id),
                provideCapability: (/** @type {string} */ id, /** @type {unknown} */ value) => {
                    scope.assertActive();
                    this.capabilities.set(id, value);
                    const release = scope.addCleanup(() => {
                        if (this.capabilities.get(id) !== value) return;
                        this.capabilities.delete(id);
                        this.capabilityEvents.dispatchEvent(new Event(id));
                    });
                    this.capabilityEvents.dispatchEvent(new Event(id));
                    return release;
                },
                onCapabilityChanged: (/** @type {string} */ id, /** @type {() => void} */ listener) => scope.listen(this.capabilityEvents, id, listener),
                isCompatibilityBeanAvailable: (/** @type {string} */ name) => this.isCompatibilityBeanAvailable(name),
                resolveCompatibilityBean: this.runtimeLookup.getBean,
                registerCompatibilityBean: (/** @type {string} */ name, /** @type {any} */ bean) => {
                    scope.assertActive();
                    return scope.addCleanup(this.runtimeLookup.register(name, bean));
                },
                diagnostics: this.diagnostics,
                inspect: inspection && ((/** @type {string} */ name, /** @type {unknown} */ value) => {
                    inspection[name] = value;
                    scope.addCleanup(() => { if (inspection[name] === value) delete inspection[name]; });
                }),
            }));
            scope.assertActive();
            activeContributions = Object.freeze(result?.activeContributions ?? enabledContributions);
            for (const command of manifest.providesCommands) {
                const handler = result?.commands?.[command];
                if (typeof handler !== "function") throw new Error(`Feature ${manifest.id} did not provide command ${command}`);
            }
            for (const command of manifest.providesCommands) releaseCommands.push(scope.addCleanup(this.commands.registerHandler(command, result?.commands?.[command], manifest.id)));
            this.diagnostics.setFeature(manifest.id, true);
            activeContributions.forEach((/** @type {string} */ id) => this.diagnostics.setContribution(id, true));
            this.diagnostics.recordStartup(manifest.id, performance.now() - started);
            return Object.freeze({ manifest, scope, enabledContributions: activeContributions, dispose });
        } catch (error) {
            try { dispose(); } catch (cleanupError) { this.diagnostics.recordError(cleanupError); }
            this.diagnostics.recordError(error);
            throw error;
        }
    }

    /** @param {any} [snapshot] */
    async start(snapshot) {
        if (snapshot) {
            this.configurationSnapshot = snapshot;
            this.disabled = new Set(migrateDisabledPlugins(parseDisabledPlugins(snapshot.disabledPlugins)));

            for (const manifest of this.manifests.values()) for (const command of manifest.providesCommands) this.commands.setOwnerEnabled(command, this.isEligible(manifest));
        }
        this.started = true;
        this.diagnostics.featureDescriptors = this.getFeatureDescriptors();
        this.diagnostics.contributionDescriptors = [...this.contributionOwners].flatMap(([id, owner]) => {
            const feature = this.manifests.get(owner);
            const sites = feature?.contributionAvailability?.[id]?.sites ?? feature?.sites;
            return sites?.includes(this.site) ? [{ id, disableable: feature?.kind !== "system" && feature?.disableable !== false }] : [];
        });
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
            const activate = async () => {
                // System controls mount promptly; only optional automatic work waits for quiet.
                if (manifest.kind !== "system" && this.backgroundWork) await this.backgroundWork.waitForTurn();
                if (!this.isEligible(manifest)) return;
                void this.activate(manifest.id).catch(() => undefined);
            };
            if (typeof globalThis.requestIdleCallback === "function") globalThis.requestIdleCallback(() => { void activate().catch(() => undefined); }, { timeout: 1500 });
            else setTimeout(() => { void activate().catch(() => undefined); }, 100);
        }
    }

    getActiveFeatureIds() { return [...this.activations.keys()]; }
}
