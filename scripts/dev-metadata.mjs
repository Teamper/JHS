import { readMetadataField, replaceMetadataFields, runtimeBuildMarker } from "./delivery-artifact.mjs";

export function readDevIdentity(source) {
    const version = readMetadataField(source, "version", "Dev").trimEnd();
    const buildId = /^JHS 7\.0 migration build ([a-f0-9]{12}(?:\.dirty)?)\s*$/.exec(readMetadataField(source, "description", "Dev"))?.[1];
    if (!/^7\.0\.0-dev\.\d{12}$/.test(version) || !buildId || !source.includes(JSON.stringify(`${version}|${buildId}`))) throw new Error("交付文件缺少有效 Dev 身份");
    return { version, buildId };
}

/** One Dev identity for normal delivery and same-metadata size/performance comparisons. */
export function createDevTransforms(version, buildId) {
    return {
        transformMetadata: metadata => replaceMetadataFields(metadata, {
            name: "JHS Dev 7.0", namespace: "https://github.com/Teamper/JHS/dev/7.0",
            version, description: `JHS 7.0 migration build ${buildId}`,
        }).replace(/^\/\/ @(downloadURL|updateURL).*(?:\r?\n|$)/gm, ""),
        transformBundle: bundle => `${runtimeBuildMarker("dev", version, buildId)}\n${bundle}`,
    };
}
