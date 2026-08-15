const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CACHE_TTL = Object.freeze({ magnet: 6 * HOUR, screenshot: 7 * DAY, screenshotNegative: 12 * HOUR, match115: HOUR, externalDetail: DAY });

class ProviderError extends Error {
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
