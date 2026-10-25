/** One Dev identity for normal delivery and same-metadata size/performance comparisons. */
export function createDevTransforms(version, buildId) {
    return {
        transformMetadata: metadata => metadata
            .replace(/^\/\/ @name\s+.+$/m, "// @name         JHS Dev 7.0")
            .replace(/^\/\/ @namespace\s+.+$/m, "// @namespace    https://github.com/Teamper/JHS/dev/7.0")
            .replace(/^\/\/ @version\s+.+$/m, `// @version      ${version}`)
            .replace(/^\/\/ @description\s+.+$/m, `// @description  JHS 7.0 migration build ${buildId}`)
            .replace(/^\/\/ @(downloadURL|updateURL).*(?:\r?\n|$)/gm, ""),
        transformBundle: bundle => `document.documentElement?.setAttribute("data-jhs-dev-build", ${JSON.stringify(`${version}|${buildId}`)});\n${bundle}`,
    };
}
