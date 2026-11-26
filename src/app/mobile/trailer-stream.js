// @ts-check
import Hls from "hls.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

/** @param {any} http @param {string} origin */
function createLoader(http, origin) {
    return class PreviewLoader {
        stats = { aborted: false, loaded: 0, total: 0, retry: 0, chunkCount: 0, bwEstimate: 0,
            loading: { start: 0, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 } };
        /** @type {LifecycleScope | undefined} */ request;
        /** @type {any} */ context;
        /** @param {any} context @param {any} config @param {any} callbacks */
        load(context, config, callbacks) {
            this.context = context;
            const scope = this.request = new LifecycleScope("android:trailer-stream");
            this.stats.loading.start = performance.now();
            const headers = Number.isFinite(context.rangeStart) && Number.isFinite(context.rangeEnd)
                ? { Range: "bytes=" + context.rangeStart + "-" + (context.rangeEnd - 1) } : {};
            const read = async () => {
                let result;
                try {
                    result = await http.request({
                        url: context.url, providerId: "android-trailer", responseType: context.responseType, headers,
                        timeout: Math.min(15000, config.timeout || 12000), retryCount: 0, maxResponseBytes: 24 * 1024 * 1024,
                        urlPolicy: { trustClass: "custom-public", expectedOrigin: origin },
                        requestOptions: { anonymous: true, redirect: "error" },
                    }, scope);
                } catch (error) {
                    if (!scope.disposed) callbacks.onError({ code: 0, text: "预告流读取失败" }, context, null, this.stats);
                    return;
                }
                if (scope.disposed) return;
                const { data } = result;
                this.stats.loaded = this.stats.total = typeof data === "string" ? data.length : data.byteLength;
                this.stats.loading.first = this.stats.loading.end = performance.now();
                callbacks.onSuccess({ url: result.finalUrl || context.url, data, code: result.status }, this.stats, context, null);
            };
            void read();
        }
        abort() { this.stats.aborted = true; this.request?.dispose(); }
        destroy() { this.abort(); }
    };
}

/** @param {any} http @param {string} url @param {HTMLVideoElement} player @param {()=>void} onReady @param {()=>void} onError */
export function openHls(http, url, player, onReady, onError) {
    if (!Hls.isSupported()) {
        if (player.canPlayType("application/vnd.apple.mpegurl")) {
            player.src = url;
            onReady();
        } else queueMicrotask(onError);
        return undefined;
    }
    const engine = new Hls({ enableWorker: false, loader: /** @type {any} */ (createLoader(http, new URL(url).origin)) });
    engine.on(Hls.Events.ERROR, (_event, result) => { if (result.fatal) onError(); });
    engine.on(Hls.Events.MANIFEST_PARSED, onReady);
    engine.attachMedia(player);
    engine.loadSource(url);
    return engine;
}
