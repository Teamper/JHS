// @ts-check

/** Run a not-yet-migrated contribution under its owning Feature lifetime. */
/** @param {{featureId: string, contributionId: string, plugin: any, scope: import("./lifecycle-scope.js").LifecycleScope, diagnostics: any}} options */
export async function activateLegacyContributionAdapter(options) {
    const { featureId, contributionId, plugin, scope, diagnostics } = options;
    const report = (/** @type {unknown} */ error) => diagnostics?.recordError?.({
        source: "feature-lifecycle-adapter", featureId, contributionId,
        message: error instanceof Error ? error.message : String(error),
    });
    if (!plugin) {
        report(new Error(`Legacy contribution behavior adapter is unavailable: ${contributionId}`));
        return false;
    }
    let stopped = false;
    const stop = () => {
        if (stopped) return;
        stopped = true;
        try { plugin.stop?.(); }
        catch (error) { report(error); }
    };
    scope.addCleanup(stop);
    try {
        scope.assertActive();
        await plugin.handle?.();
        return !scope.disposed;
    } catch (error) {
        stop();
        report(error);
        return false;
    }
}
