// @ts-check

export const JHS_ERROR_CODES = Object.freeze([
    "NETWORK_ERROR", "TIMEOUT", "AUTH_REQUIRED", "NOT_FOUND", "PARSE_ERROR",
    "RATE_LIMITED", "ABORTED", "UNSUPPORTED", "INVALID_RESPONSE", "INVALID_URL",
    "CF_BLOCKED", "CIRCUIT_OPEN",
    "MISSING_DEPENDENCY", "DUPLICATE_TOKEN", "BOOTSTRAP_FAILED",
]);

export class JhsError extends Error {
    /** @param {string} code @param {string} message @param {{source?: string, retryable?: boolean, cause?: unknown, details?: Record<string, unknown>}} [options] */
    constructor(code, message, options = {}) {
        super(message, { cause: options.cause });
        if (!JHS_ERROR_CODES.includes(code)) throw new TypeError(`Unknown JhsError code: ${code}`);
        this.name = "JhsError";
        this.code = code;
        this.source = options.source ?? "jhs";
        this.retryable = options.retryable ?? false;
        this.details = options.details ? Object.freeze({ ...options.details }) : null;
    }

    /** @param {unknown} error @param {string} [source] */
    static from(error, source = "jhs") {
        if (error instanceof JhsError) return error;
        if (error instanceof DOMException && error.name === "AbortError") {
            return new JhsError("ABORTED", "请求已取消", { source, cause: error });
        }
        const message = error instanceof Error ? error.message : String(error ?? "未知错误");
        return new JhsError("NETWORK_ERROR", message, { source, cause: error, retryable: true });
    }

    toJSON() {
        return { code: this.code, message: this.message, source: this.source, retryable: this.retryable, details: this.details };
    }
}
