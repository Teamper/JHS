// @ts-check

/** Application-owned notification, confirmation, and image-viewer entrypoints. */
export class UiService {
    constructor() {
        this.show = Object.freeze({});
        this.confirm = null;
        this.showImageViewer = null;
        this.getDialogArea = null;
        this.setupEscClose = null;
    }

    /** @param {{show?: any, confirm?: ((event: Event, message: string, callback: () => Promise<void>) => unknown) | null, showImageViewer?: ((image: any) => unknown) | null, getDialogArea?: ((preset?: string) => any) | null, setupEscClose?: ((layerIndex: number) => unknown) | null}} runtime */
    configure(runtime = {}) {
        this.show = runtime.show ?? Object.freeze({});
        this.confirm = runtime.confirm ?? null;
        this.showImageViewer = runtime.showImageViewer ?? null;
        this.getDialogArea = runtime.getDialogArea ?? null;
        this.setupEscClose = runtime.setupEscClose ?? null;
        return this;
    }
}
