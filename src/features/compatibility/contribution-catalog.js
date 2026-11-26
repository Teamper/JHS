// @ts-check
import { LEGACY_PLUGIN_CONTRIBUTION_MAP } from "../../core/legacy-plugin-contributions.js";

/** Register only compatibility lookup beans; FeatureRuntime owns all behavior. @param {import("../../core/compatibility-bean-registry.js").CompatibilityBeanRegistry} compatibilityBeans @param {import("../../app/feature-runtime.js").FeatureRuntime} featureRuntime @param {string} site */
export function registerSiteCompatibility(compatibilityBeans, featureRuntime, site) {
    featureRuntime.compatibilityRefresh = () => registerSiteCompatibility(compatibilityBeans, featureRuntime, site);
    featureRuntime.setCompatibilityBeanResolver?.((name) => compatibilityBeans.lookupCompatibilityBean(name));
    featureRuntime.setCompatibilityBeanRegistrar?.((name, bean) => {
        compatibilityBeans.registerCompatibilityBean(name, bean);
        return () => compatibilityBeans.unregisterCompatibilityBean(name, bean);
    });
    const descriptors = new Map();
    for (const [name, id] of Object.entries(LEGACY_PLUGIN_CONTRIBUTION_MAP)) {
        if (descriptors.has(id)) continue;
        const featureId = featureRuntime.contributionOwners.get(id);
        const feature = featureId && featureRuntime.manifests.get(featureId);
        if (!feature || !(feature.contributionAvailability?.[id]?.sites ?? feature.sites).includes(site)) continue;
        descriptors.set(id, { name, disableable: feature.kind !== "system" && feature.disableable });
    }
    compatibilityBeans.setCatalogDescriptors([...descriptors.values()]);
}
