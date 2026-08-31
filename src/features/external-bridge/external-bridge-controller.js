// @ts-check

/**
 * Own external integrations while their legacy plugins are being moved behind
 * the Feature API.
 */
export class ExternalBridgeController {
    /** @param {{translationController?: any, oneOneFiveController?: any, offlineController?: any, oneTwoThreeController?: any, javTrailersController?: any, subtitleController?: any, scope: any}} options */
    constructor(options) {
        this.translationController = options.translationController ?? null;
        this.oneOneFiveController = options.oneOneFiveController ?? null;
        this.offlineController = options.offlineController ?? null;
        this.oneTwoThreeController = options.oneTwoThreeController ?? null;
        this.javTrailersController = options.javTrailersController ?? null;
        this.subtitleController = options.subtitleController ?? null;
        this.scope = options.scope;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve().then(() => Promise.all([
            this.oneTwoThreeController?.start(),
            this.translationController?.start(),
            this.oneOneFiveController?.start(),
            this.offlineController?.start(),
            this.javTrailersController?.start(),
            this.subtitleController?.start(),
        ])).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    /** Expose only the external-bridge capabilities needed by other Features. */
    getApi() {
        return Object.freeze({
            hasTranslation: Boolean(this.translationController),
            hasOffline: Boolean(this.offlineController),
            submitOffline: (/** @type {any[]} */ ...args) => this.offlineController?.submitResource?.(...args),
            getOfflineProvider: (/** @type {string} */ id) => this.offlineController?.registry?.providers?.get?.(id) ?? null,
        });
    }

    dispose() {
        this.started = false;
    }
}
