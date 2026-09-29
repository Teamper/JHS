// @ts-check

/** Keeps the 6.5.1 NewVideoPlugin surface while Discovery owns the implementation. */
export class NewVideoCompatibilityBean {
    /** @param {(command: string, ...args: any[]) => Promise<any>} executeCommand @param {(options: Record<string, any>) => any} createWorkspaceService */
    constructor(executeCommand, createWorkspaceService) {
        this.executeCommand = executeCommand;
        this.createWorkspaceService = createWorkspaceService;
        this.service = null;
        const shell = new Set(["executeCommand", "createWorkspaceService", "service", "getName", "createFeatureService", "connect", "disconnect", "openDialog"]);
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

    getName() { return "NewVideoPlugin"; }

    /** @param {Record<string, any>} options */
    createFeatureService(options) { return this.createWorkspaceService(options); }

    /** @param {any} service */
    connect(service) {
        if (!service) throw new TypeError("NewVideoWorkspaceService is required");
        if (this.service && this.service !== service) throw new Error("NewVideoPlugin compatibility bean is already connected");
        const shell = new Set(["executeCommand", "createWorkspaceService", "service", "getName", "createFeatureService", "connect", "disconnect", "openDialog"]);
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

    /** Activates the idle Feature first when an old caller opens the workspace directly. */
    /** @param {...any} args */
    openDialog(...args) {
        return this.service ? this.service.openDialog(...args) : this.executeCommand("new-video.open", ...args);
    }

    getPendingNewVideoTotal() { return this.service?.getPendingNewVideoTotal?.() ?? Promise.resolve(0); }
    /** @param {...any} args */
    getPendingNewVideoCount(...args) { return this.service?.getPendingNewVideoCount?.(...args) ?? 0; }
}
