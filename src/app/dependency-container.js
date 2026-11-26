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

    /** @param {readonly symbol[]} requiredTokens @param {readonly symbol[]} [optionalTokens] */
    resolveDeclared(requiredTokens, optionalTokens = []) {
        const dependencies = Object.create(null);
        const declared = [...requiredTokens, ...optionalTokens];
        const seen = new Set();
        for (const token of declared) {
            if (seen.has(token)) {
                const error = new JhsError("DUPLICATE_TOKEN", `Duplicate declared dependency: ${String(token)}`, { source: "DependencyContainer" });
                this.diagnostics?.recordError?.(error);
                throw error;
            }
            seen.add(token);
        }
        for (const token of requiredTokens) {
            if (!this.values.has(token)) {
                const error = new JhsError("MISSING_DEPENDENCY", `Missing declared dependency: ${String(token)}`, { source: "DependencyContainer" });
                this.diagnostics?.recordError?.(error);
                throw error;
            }
            dependencies[token] = this.values.get(token);
        }
        for (const token of optionalTokens) {
            if (this.values.has(token)) dependencies[token] = this.values.get(token);
        }
        return dependencies;
    }
}
