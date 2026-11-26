// @ts-check

export function sleep(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** @template This @template {unknown[]} Args @param {(this: This, ...args: Args) => unknown} callback @param {number} [wait] */
export function debounce(callback, wait = 200) {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    const debounced = function(/** @type {This} */ thisValue, /** @type {Args} */ args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            callback.apply(thisValue, args);
        }, Math.max(0, wait));
    };
    return Object.assign(
        /** @this {This} @param {Args} args */
        function (...args) { debounced(this, args); },
        { cancel() { clearTimeout(timer); timer = undefined; } },
    );
}

export function createTimers() {
    /** @type {Map<string, {startedAt: number, unit: string, precision: number}>} */
    const timings = new Map();
    return (name = "default", unit = "s", precision = 2) => {
        const previous = timings.get(name);
        if (!previous) {
            timings.set(name, { startedAt: performance.now(), unit, precision });
            return;
        }
        timings.delete(name);
        const elapsed = performance.now() - previous.startedAt;
        const seconds = previous.unit === "s";
        return `${name}: ${(seconds ? elapsed / 1000 : elapsed).toFixed(previous.precision)}${seconds ? "秒" : "毫秒"}`;
    };
}
