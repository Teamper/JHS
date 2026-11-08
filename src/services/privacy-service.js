// @ts-check

export const PRIVACY_STATE_KEY = "jhs_privacy_enabled_v1";
export const PRIVACY_TARGETS = Object.freeze(["title", "code", "actors", "images", "video"]);

/** Local activation is separate from portable masking preferences. */
export class PrivacyService extends EventTarget {
    /** @param {{storage: any, settings: any}} options */
    constructor({ storage, settings }) {
        super();
        this.storage = storage;
        this.settings = settings;
        this.enabled = false;
        this.active = false;
        this.revealed = false;
        this.writeChain = Promise.resolve();
        this.listener = storage.listenValue(PRIVACY_STATE_KEY, () => { void this.load(); });
    }
    async load() {
        this.enabled = await this.storage.getValue(PRIVACY_STATE_KEY, false) === true;
        this.revealed = false;
        this.changed();
    }
    /** @param {boolean} enabled */
    setEnabled(enabled) { return this.updateEnabled(() => enabled); }
    toggle() { return this.updateEnabled(() => !this.enabled); }
    /** @param {() => boolean} resolve */
    updateEnabled(resolve) {
        const operation = this.writeChain.catch(() => {}).then(async () => {
            const enabled = resolve();
            await this.storage.setValue(PRIVACY_STATE_KEY, enabled);
            if (await this.storage.getValue(PRIVACY_STATE_KEY, false) !== enabled) throw new Error("隐私遮罩状态保存失败");
            this.enabled = enabled;
            this.revealed = false;
            this.changed();
        });
        this.writeChain = operation;
        return operation;
    }
    /** @param {boolean} value */
    reveal(value) {
        const next = this.enabled && value;
        if (this.revealed === next) return;
        this.revealed = next;
        this.changed();
    }
    targets() {
        const values = this.settings.snapshot().privacyTargets;
        return Array.isArray(values) ? values.filter(value => PRIVACY_TARGETS.includes(value)) : [...PRIVACY_TARGETS];
    }
    get masked() { return this.active && this.enabled && !this.revealed; }
    /** @param {boolean} value */
    setActive(value) { this.active = value; this.revealed = false; this.changed(); }
    changed() { this.dispatchEvent(new Event("privacy.changed")); }
    dispose() { if (this.listener != null) this.storage.unlistenValue(this.listener); this.reveal(false); }
}
