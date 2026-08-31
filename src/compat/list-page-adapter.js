// @ts-check

import { BasePlugin } from "../core/plugin-manager.js";

/**
 * Compatibility shell for callers that still resolve ListPagePlugin by name.
 * The business implementation is owned by the List Feature and exposed here
 * through its stable API; the retired legacy implementation is not bundled.
 */
export class ListPagePluginAdapter extends BasePlugin {
    /** @param {...any} args */
    constructor(...args) {
        super(...args);
        /** @type {any} */ this.delegate = null;
        /** @type {Record<string, any> | null} */ this.featureApi = null;
        return new Proxy(this, {
            get: (target, property, receiver) => {
                if (property in target) return Reflect.get(target, property, receiver);
                const featureApi = target.featureApi;
                const featureValue = typeof property === "string" ? featureApi?.[property] : undefined;
                if (featureValue !== undefined) return typeof featureValue === "function" ? featureValue.bind(featureApi) : featureValue;
                if (featureApi && property === "activeQuickFilter") return featureApi.getActiveQuickFilter?.();
                const delegate = /** @type {any} */ (target.delegate);
                const value = delegate?.[property];
                return typeof value === "function" ? value.bind(target.delegate) : value;
            },
        });
    }

    getName() { return "ListPagePlugin"; }

    /** PluginManager must not register feature-owned CSS. */
    initCss() { return ""; }

    /** FeatureRuntime owns the actual lifecycle. */
    handle() {}

    /** Bind the stable Feature API for legacy callers without remounting business logic. @param {Record<string, any> | null} api */
    setFeatureApi(api) {
        this.featureApi = api;
        return api;
    }

    /** Keep the historical migration hook without recreating the removed implementation. */
    ensureDelegate() {
        return this;
    }
}

ListPagePluginAdapter.legacyPluginId = "ListPagePlugin";
