// @ts-check

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const CACHE_TTL = Object.freeze({ magnet: 6 * HOUR, screenshot: 7 * DAY, screenshotNegative: 12 * HOUR, match115: HOUR, externalDetail: DAY });

export class ProviderError extends Error {
    /** @param {string} provider @param {string} code @param {string} message @param {{cause?: unknown, status?: number, url?: string, retryable?: boolean}} [options] */
    constructor(provider, code, message, options = {}) {
        super(message, { cause: options.cause });
        this.name = "ProviderError";
        this.provider = provider;
        this.code = code;
        this.status = options.status || 0;
        this.url = options.url || "";
        this.retryable = Boolean(options.retryable);
    }
}
// @ts-check
