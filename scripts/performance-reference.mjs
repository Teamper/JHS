export function summarizePerformanceSamples(values) {
    if (values.length !== 30 || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error("性能门禁必须包含 30 项有限非负采样");
    const sorted = [...values].sort((a, b) => a - b);
    return { p50: sorted[15], p95: sorted[28] };
}
export function assertPerformanceReference(reference, candidate) {
    if (reference.schema !== 1 || JSON.stringify(reference.environment) !== JSON.stringify(candidate.environment)) throw new Error("性能环境与封存参考不一致，请在原环境复测");
    if (JSON.stringify(Object.keys(reference.metrics).sort()) !== JSON.stringify(Object.keys(candidate.metrics).sort())) throw new Error("性能场景与封存参考不一致");
    for (const [key, value] of Object.entries(candidate.metrics)) for (const percentile of ["p50", "p95"]) {
        const baseline = reference.metrics[key][percentile], actual = value[percentile];
        if (!Number.isFinite(baseline) || baseline < 0 || !Number.isFinite(actual) || actual < 0) throw new Error("无效的性能参考值");
        if (actual > baseline * 1.1) throw new Error(`${key}/${percentile}: ${actual.toFixed(1)}ms > ${(baseline * 1.1).toFixed(1)}ms`);
    }
}
export function assertReferenceTightens(sealed, reference) {
    if (JSON.stringify(sealed.environment) !== JSON.stringify(reference.environment) || JSON.stringify(Object.keys(sealed.metrics).sort()) !== JSON.stringify(Object.keys(reference.metrics).sort())) throw new Error("封存的性能环境或场景不能直接替换");
    for (const [key, value] of Object.entries(sealed.metrics)) for (const percentile of ["p50", "p95"]) {
        const next = reference.metrics[key][percentile];
        if (!Number.isFinite(next) || next < 0 || next > value[percentile]) throw new Error(`已封存上限只允许收紧：${key}/${percentile}`);
    }
}
