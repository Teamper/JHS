// @ts-check

import { JhsError } from "../core/jhs-error.js";

export class DependencyContainer {
    /** @param {{recordError?: (error: unknown) => void} | null} [diagnostics] */
    constructor(diagnostics = null) {
        /** @type {Map<symbol, unknown>} */
        this.values = new Map();
        this.diagnostics = diagnostics;
    }

    /** @param {symbol} token @param {unknown} value */
    register(token, value) {
        if (typeof token !== "symbol") throw new TypeError("Dependency token must be a symbol");
        if (this.values.has(token)) {
            const error = new JhsError("DUPLICATE_TOKEN", `Duplicate dependency token: ${String(token)}`, { source: "DependencyContainer" });
            this.diagnostics?.recordError?.(error);
            throw error;
        }
        this.values.set(token, value);
        return this;
    }

    /** @param {readonly symbol[]} requiredTokens */
    resolveDeclared(requiredTokens) {
        const dependencies = Object.create(null);
        const seen = new Set();
        for (const token of requiredTokens) {
            if (seen.has(token)) {
                const error = new JhsError("DUPLICATE_TOKEN", `Duplicate declared dependency: ${String(token)}`, { source: "DependencyContainer" });
                this.diagnostics?.recordError?.(error);
                throw error;
            }
            seen.add(token);
            if (!this.values.has(token)) {
                const error = new JhsError("MISSING_DEPENDENCY", `Missing declared dependency: ${String(token)}`, { source: "DependencyContainer" });
                this.diagnostics?.recordError?.(error);
                throw error;
            }
            Object.defineProperty(dependencies, token, {
                value: this.values.get(token),
                enumerable: true,
            });
        }
        return Object.freeze(dependencies);
    }
}
