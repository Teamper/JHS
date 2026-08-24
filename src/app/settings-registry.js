// @ts-check

export class SettingsRegistry {
    constructor() { this.descriptors = new Map(); }
    /** @param {{id: string, owner: string, contribution?: string, validate?: (value: unknown) => boolean} & Record<string, any>} descriptor */
    register(descriptor) {
        if (!descriptor?.id || !descriptor.owner) throw new TypeError("Setting descriptor requires id and owner");
        if (this.descriptors.has(descriptor.id)) throw new Error(`Duplicate setting descriptor: ${descriptor.id}`);
        this.descriptors.set(descriptor.id, Object.freeze({ ...descriptor }));
    }
    /** @param {{disabledContributions?: Set<string>}} [options] */
    list(options = {}) { return [...this.descriptors.values()].filter((descriptor) => !descriptor.contribution || !options.disabledContributions?.has(descriptor.contribution)); }
    /** @param {string} id */
    get(id) { return this.descriptors.get(id) ?? null; }
}
