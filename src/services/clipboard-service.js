// @ts-check

/** Explicit clipboard capability backed by the established clipboard helper during migration. */
export class ClipboardService {
    /** @param {(label: string, value: unknown) => Promise<boolean>} [copyText] */
    constructor(copyText = async () => false) {
        this.copyTextWithFallback = copyText;
    }

    /** @param {string} label @param {unknown} value */
    copyText(label, value) { return this.copyTextWithFallback(label, value); }
}
