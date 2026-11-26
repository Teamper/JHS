import { register } from "node:module";
import { isMainThread } from "node:worker_threads";

const shared = new Map([
    ["@jhs/core", "shared-core/index.js"],
    ["@jhs/fixtures", "shared-fixtures/fixtures.js"],
    ["@jhs/parsers", "shared-parsers/index.js"],
]);

if (isMainThread) register(import.meta.url);

export function resolve(specifier, context, nextResolve) {
    const entry = shared.get(specifier);
    return nextResolve(entry ? new URL(`../packages/${entry}`, import.meta.url).href : specifier, context);
}
