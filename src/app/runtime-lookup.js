// @ts-check
export function createRuntimeLookup() {
    /** @type {Map<string, any>} */
    const instances = new Map();
    return {
        /** @param {string} name */
        getBean: (name) => instances.get(name),
        /** @param {string} name @param {any} instance */
        register(name, instance) {
            if (!name || !instance || instances.has(name)) throw new Error(`兼容 Bean 重复或无效: ${name}`);
            instances.set(name, instance);
            return () => {
                if (instances.get(name) === instance) instances.delete(name);
            };
        },
    };
}
