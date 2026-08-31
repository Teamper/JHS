// @ts-check

import { BasePlugin } from "../core/plugin-manager.js";
import { ListPagePlugin } from "../plugins/status/list-page.js";

/**
 * Compatibility shell for callers that still resolve ListPagePlugin by name.
 * The business implementation is created and owned by the List Feature.
 */
export class ListPagePluginAdapter extends BasePlugin {
    /** @param {...any} args */
    constructor(...args) {
        super(...args);
        /** @type {ListPagePlugin | null} */ this.delegate = null;
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

    /** @param {{scope: () => Promise<any>}} options */
    ensureDelegate(options) {
        if (this.delegate) return this.delegate;
        const delegate = new ListPagePlugin();
        delegate.pluginManager = this.pluginManager;
        delegate.declaredDependencies = this.declaredDependencies;
        delegate.runtimeServices = Object.freeze({ ...this.runtimeServices, scope: options.scope });
        this.delegate = delegate;
        return delegate;
    }
}

ListPagePluginAdapter.legacyPluginId = "ListPagePlugin";
