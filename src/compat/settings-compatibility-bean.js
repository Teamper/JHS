// @ts-check

/** Preserves the 6.5.1 SettingPlugin lookup surface while Settings Feature owns the service. */
export class SettingsCompatibilityBean {
    /** @param {(options: Record<string, any>) => any} createSettingsService */
    constructor(createSettingsService) {
        this.createSettingsService = createSettingsService;
        this.service = null;
        const shell = new Set(["createSettingsService", "service", "getName", "createFeatureService", "connect", "disconnect"]);
        return new Proxy(this, {
            get: (target, property, receiver) => {
                if (!shell.has(String(property)) && Object.hasOwn(target, property)) return Reflect.get(target, property, receiver);
                const service = target.service;
                if (!shell.has(String(property)) && service && property in service) {
                    const value = service[property];
                    return typeof value === "function" ? value.bind(service) : value;
                }
                return Reflect.get(target, property, receiver);
            },
            set: (target, property, value, receiver) => {
                const service = target.service;
                if (!shell.has(String(property)) && service && property in service) return Reflect.set(service, property, value, service);
                return Reflect.set(target, property, value, receiver);
            },
        });
    }

    getName() { return "SettingPlugin"; }

    /** @param {Record<string, any>} options */
    createFeatureService(options) { return this.createSettingsService(options); }

    /** @param {any} service */
    connect(service) {
        if (!service) throw new TypeError("Settings Feature service is required");
        if (this.service && this.service !== service) throw new Error("SettingPlugin compatibility bean is already connected");
        const shell = new Set(["createSettingsService", "service", "getName", "createFeatureService", "connect", "disconnect"]);
        for (const property of Reflect.ownKeys(this)) {
            if (shell.has(String(property))) continue;
            Reflect.set(service, property, Reflect.get(this, property), service);
            Reflect.deleteProperty(this, property);
        }
        this.service = service;
    }

    /** @param {any} service */
    disconnect(service) {
        if (this.service === service) this.service = null;
    }
}
