// @ts-check

/** Stable injected boundary for the JavBus list image-layout contribution. */
export class BusImageLayoutService {
    constructor() {
        /** @type {{logImageHeightsByRow: (options?: any) => Promise<void>, dispose?: () => void} | null} */
        this.controller = null;
    }

    /** @param {{logImageHeightsByRow: (options?: any) => Promise<void>, dispose?: () => void}} controller */
    attach(controller) {
        if (this.controller && this.controller !== controller) throw new Error("JavBus image layout already has an active controller");
        this.controller = controller;
        let attached = true;
        return () => {
            if (!attached) return;
            attached = false;
            if (this.controller !== controller) return;
            this.controller = null;
            controller.dispose?.();
        };
    }

    /** @param {any} [options] */
    logImageHeightsByRow(options) {
        return this.controller?.logImageHeightsByRow(options) ?? Promise.resolve();
    }
}
