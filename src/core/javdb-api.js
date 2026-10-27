// @ts-check

import { decryptData } from "./credential-crypto.js";

export const U = "https://jdforrepam.com/api";
let signatureSecond = 0, signatureValue = "";

async function readJavDbToken() {
    const runtime = /** @type {any} */ (globalThis);
    if (runtime.credentialService?.get) return runtime.credentialService.get("jhs_appAuthorization");
    const encrypted = localStorage.getItem("jhs_appAuthorization");
    return encrypted ? decryptData(encrypted) : "";
}

/** 生成 JavDB API 请求签名 (HMAC-时间戳+盐+MD5, 20秒缓存) */
export function O() {
    const now = Math.floor(Date.now() / 1e3);
    if (signatureValue && now - signatureSecond <= 20) return signatureValue;
    signatureSecond = now;
    signatureValue = `${now}.lpw6vgqzsp.${md5(`${now}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return signatureValue;
}

/** Legacy API entry points delegate account state to the shared service. */
let wantService = /** @type {any} */ (null);
/** Composition root binds the account owner; compatibility callers keep the old API. @param {any} service */
export function bindJavDbWantService(service) {
    wantService = service;
    return () => { if (wantService === service) wantService = null; };
}
function legacyWantService() {
    if (!wantService) throw new Error("JavDB 账号服务尚未就绪");
    return wantService;
}
/** @param {unknown} movieId @param {{scope?: import("./lifecycle-scope.js").LifecycleScope}} [options] */
export async function markJavDbWantWatch(movieId, options = {}) {
    const id = String(movieId || "").trim();
    if (!id) throw new Error("JavDB 影片 ID 无效");
    return legacyWantService().mark(id, options);
}
/** null means not logged in, incomplete scan, or an account changed during lookup. */
/** @param {unknown} movieId @param {{scope?: import("./lifecycle-scope.js").LifecycleScope}} [options] */
export async function getJavDbWantWatchState(movieId, options = {}) {
    const id = String(movieId || "").trim();
    if (!id) throw new Error("JavDB 影片 ID 无效");
    return legacyWantService().get(id, options);
}

export const V = async (/** @type {string} */ e) => {
    let t = `${U}/v4/movies/${e}`, n = {
        jdSignature: await O()
    };
    const a = await storageManager.cachedRequest(`movie-detail:${e}`, 6048e5, (async () => {
        const e = await gmHttp.get(t, null, n);
        if (!e.data) throw new Error(e.message || "获取视频详情失败");
        return e;
    }));
    if (!a.data) {
        const error = new Error(a.message);
        clog.error("影片详情加载失败", error), show.error("影片详情加载失败，请重试");
        throw error;
    }
    const i = a.data.movie, s = i.preview_images;
    /** @type {string[]} */
    const o = [];
    return s.forEach(((/** @type {{large_url: string}} */ e) => {
        o.push(e.large_url.replace(/https:\/\/[^/]+\/rhe951l4q/, "https://c0.jdbstatic.com"));
    })), {
        movieId: i.id,
        actors: i.actors,
        duration: i.duration,
        title: i.origin_title,
        carNum: i.number,
        score: i.score,
        releaseDate: i.release_date,
        watchedCount: i.watched_count,
        imgList: o
    };
}, W = async (/** @type {string} */ e = "daily", /** @type {string} */ t = "high_score") => {
    let n = `${U}/v1/rankings/playback?period=${e}&filter_by=${t}`, a = {
        jdSignature: await O()
    };
    return (await gmHttp.get(n, null, a)).data.movies;
}, q = async (/** @type {string} */ e = "all", /** @type {string} */ t = "", /** @type {number} */ n = 1, /** @type {number} */ a = 40) => {
    let i = `${U}/v1/movies/top?start_rank=1&type=${e}&type_value=${t}&ignore_watched=false&page=${n}&limit=${a}`;
    const c = await readJavDbToken();
    let s = {
        "user-agent": "Dart/3.5 (dart:io)",
        "accept-language": "zh-TW",
        host: "jdforrepam.com",
        authorization: "Bearer " + c,
        jdsignature: await O()
    };
    return await gmHttp.get(i, null, s);
};
