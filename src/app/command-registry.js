// @ts-check

export class CommandRegistry {
    constructor() {
        /** @type {Map<string, string>} */
        this.owners = new Map();
        /** @type {Map<string, (...args: any[]) => any>} */
        this.handlers = new Map();
        /** @type {((featureId: string) => Promise<void>) | null} */
        this.activateOwner = null;
        /** @type {Map<string, boolean>} */
        this.ownerEnabled = new Map();
    }

    /** @param {string} command @param {boolean} enabled */
    setOwnerEnabled(command, enabled) {
        if (!this.owners.has(command)) throw new Error(`Unknown command owner: ${command}`);
        this.ownerEnabled.set(command, enabled);
    }

    /** 命令可用性：owner 已注册且未被功能禁用。 @param {string} command */
    isAvailable(command) {
        return this.owners.has(command) && this.ownerEnabled.get(command) !== false;
    }

    /** @param {(featureId: string) => Promise<void>} activator */
    setActivator(activator) { this.activateOwner = activator; }

    /** @param {string} command @param {string} featureId */
    registerOwner(command, featureId) {
        const owner = this.owners.get(command);
        if (owner && owner !== featureId) throw new Error(`Duplicate command owner: ${command}`);
        this.owners.set(command, featureId);
    }

    /** @param {string} command @param {(...args: any[]) => any} handler @param {string} featureId */
    registerHandler(command, handler, featureId) {
        if (this.owners.get(command) !== featureId) throw new Error(`Feature ${featureId} does not own command ${command}`);
        if (this.handlers.has(command)) throw new Error(`Duplicate command handler: ${command}`);
        this.handlers.set(command, handler);
    }

    /** @param {string} command @param  {...any} args */
    async execute(command, ...args) {
        const owner = this.owners.get(command);
        if (!owner) throw new Error(`Unknown command: ${command}`);
        if (!this.handlers.has(command)) {
            if (!this.activateOwner) throw new Error("Command activator is not configured");
            await this.activateOwner(owner);
        }
        const handler = this.handlers.get(command);
        if (!handler) throw new Error(`Feature ${owner} did not register ${command}`);
        return handler(...args);
    }
}
