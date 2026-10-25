/** Absolute project limits; historical bundle metadata never determines the ceiling. */
export function validateBundleBudget(bundle) {
    if (typeof bundle?.reason !== "string" || !bundle.reason.trim()) {
        throw new Error("Bundle budget changes require a non-empty reason");
    }
    for (const key of ["softLimitBytes", "hardLimitBytes"]) {
        if (!Number.isSafeInteger(bundle[key]) || bundle[key] <= 0) {
            throw new Error(`Bundle budget ${key} must be a positive safe integer`);
        }
    }
    if (bundle.softLimitBytes >= bundle.hardLimitBytes) {
        throw new Error("Bundle budget softLimitBytes must be less than hardLimitBytes");
    }
}

export function evaluateBundleBudget(sizeBytes, bundle) {
    validateBundleBudget(bundle);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
        throw new Error("Bundle budget artifact size must be a non-negative safe integer");
    }
    const { softLimitBytes, hardLimitBytes } = bundle;
    return {
        sizeBytes, softLimitBytes, hardLimitBytes,
        status: sizeBytes > hardLimitBytes ? "exceeded" : sizeBytes > softLimitBytes ? "warning" : "ok",
        remainingSoftBytes: softLimitBytes - sizeBytes,
        remainingHardBytes: hardLimitBytes - sizeBytes,
    };
}

export function formatBundleBudget(label, result) {
    return `Bundle budget ${result.status}: ${label} ${result.sizeBytes} bytes; soft ${result.softLimitBytes}, hard ${result.hardLimitBytes} bytes; remaining soft ${result.remainingSoftBytes} bytes, remaining hard ${result.remainingHardBytes} bytes`;
}
