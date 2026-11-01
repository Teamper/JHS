/** Explicit channel selection keeps the normal Dev identity assertions strict. */
export function expectedBuildIdentity() {
    if (process.env.JHS_TEST_CHANNEL === "rc") return {
        attribute: "data-jhs-rc-build", pattern: /^7\.0\.0-rc\.[1-9]\d*\|[a-f0-9]{40}$/,
    };
    if (process.env.JHS_TEST_CHANNEL && process.env.JHS_TEST_CHANNEL !== "dev") throw new Error("Unknown test build channel");
    return { attribute: "data-jhs-dev-build", pattern: /^7\.0\.0-dev\.\d{12}\|[0-9a-f]{12}(?:\.dirty)?$/ };
}
