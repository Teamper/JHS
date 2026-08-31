// @ts-check

/** Application-owned notification, confirmation, and page UI entrypoints. */
export class UiService {
    constructor() {
        this.show = Object.freeze({});
        this.clog = Object.freeze({});
        this.loading = () => ({ close() {} });
        this.jquery = null;
        this.confirm = null;
        this.showImageViewer = null;
        this.getDialogArea = null;
        this.setupEscClose = null;
        this.time = null;
        this.openPage = null;
    }

    /** @param {{show?: any, clog?: any, loading?: (() => any) | null, jquery?: any, confirm?: ((event: Event | null, message: string, callback: () => Promise<void>) => unknown) | null, showImageViewer?: ((image: any) => unknown) | null, getDialogArea?: ((preset?: string) => any) | null, setupEscClose?: ((layerIndex: number) => unknown) | null, time?: ((label?: string) => unknown) | null, openPage?: ((url: string, carNum: string, shadeClose?: boolean, options?: any) => unknown) | null}} runtime */
    configure(runtime = {}) {
        this.show = runtime.show ?? Object.freeze({});
        this.clog = runtime.clog ?? Object.freeze({});
        this.loading = runtime.loading ?? (() => ({ close() {} }));
        this.jquery = runtime.jquery ?? null;
        this.confirm = runtime.confirm ?? null;
        this.showImageViewer = runtime.showImageViewer ?? null;
        this.getDialogArea = runtime.getDialogArea ?? null;
        this.setupEscClose = runtime.setupEscClose ?? null;
        this.time = runtime.time ?? null;
        this.openPage = runtime.openPage ?? null;
        return this;
    }

    getJQuery() { return this.jquery; }
    getClog() { return this.clog; }
    getLoading() { return this.loading; }
}
