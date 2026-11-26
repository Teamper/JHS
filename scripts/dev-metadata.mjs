export function readDevIdentity(source) {
    const version = source.match(/^\/\/ @version\s+(7\.0\.0-dev\.\d{12})\s*$/m)?.[1];
    const buildId = source.match(/^\/\/ @description\s+JHS 7\.0 migration build ([a-f0-9]{12}(?:\.dirty)?)\s*$/m)?.[1];
    if (!version || !buildId || !source.includes(JSON.stringify(`${version}|${buildId}`))) throw new Error("交付文件缺少有效 Dev 身份");
    return { version, buildId };
}

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
