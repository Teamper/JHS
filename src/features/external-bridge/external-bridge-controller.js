// @ts-check

/**
 * Own external integrations while their legacy plugins are being moved behind
 * the Feature API.
 */
export class ExternalBridgeController {
    /** @param {{translationController?: any, oneOneFivePlugin?: any, unifiedOfflinePlugin?: any, oneTwoThreePlugin?: any, javTrailersPlugin?: any, subtitlePlugin?: any, scope: any}} options */
    constructor(options) {
        this.translationController = options.translationController ?? null;
        this.oneOneFivePlugin = options.oneOneFivePlugin ?? null;
        this.unifiedOfflinePlugin = options.unifiedOfflinePlugin ?? null;
        this.oneTwoThreePlugin = options.oneTwoThreePlugin ?? null;
        this.javTrailersPlugin = options.javTrailersPlugin ?? null;
        this.subtitlePlugin = options.subtitlePlugin ?? null;
        this.scope = options.scope;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve().then(() => Promise.all([
            this.oneTwoThreePlugin?.handle({ scope: this.scope }),
            this.translationController?.start(),
            this.oneOneFivePlugin?.handle({ scope: this.scope }),
            this.unifiedOfflinePlugin?.handle({ scope: this.scope, oneTwoThreePlugin: this.oneTwoThreePlugin }),
            this.javTrailersPlugin?.handle({ scope: this.scope }),
            this.subtitlePlugin?.handle({ scope: this.scope }),
        ])).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    /** Expose only the external-bridge capabilities needed by other Features. */
    getApi() {
        return Object.freeze({
            hasTranslation: Boolean(this.translationController),
            hasOffline: Boolean(this.unifiedOfflinePlugin),
            submitOffline: (/** @type {any[]} */ ...args) => this.unifiedOfflinePlugin?.submitResource?.(...args),
            getOfflineProvider: (/** @type {string} */ id) => this.unifiedOfflinePlugin?.registry?.providers?.get?.(id) ?? null,
        });
    }

    dispose() {
        this.started = false;
    }
}
