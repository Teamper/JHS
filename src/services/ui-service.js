// @ts-check

/** Application-owned notification, confirmation, and image-viewer entrypoints. */
export class UiService {
    constructor() {
        this.show = Object.freeze({});
        this.confirm = null;
        this.showImageViewer = null;
    }

    /** @param {{show?: any, confirm?: ((event: Event, message: string, callback: () => Promise<void>) => unknown) | null, showImageViewer?: ((image: any) => unknown) | null}} runtime */
    configure(runtime = {}) {
        this.show = runtime.show ?? Object.freeze({});
        this.confirm = runtime.confirm ?? null;
        this.showImageViewer = runtime.showImageViewer ?? null;
        return this;
    }
}
