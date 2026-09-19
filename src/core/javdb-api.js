// @ts-check

import { decryptData } from "./credential-crypto.js";

export const U = "https://jdforrepam.com/api";
let signatureSecond = 0, signatureValue = "";
const wantWatchStateCache = new Map();
async function readJavDbToken() {
    const runtime = /** @type {any} */ (globalThis);
    if (runtime.credentialService?.get) return runtime.credentialService.get("jhs_appAuthorization");
    const encrypted = localStorage.getItem("jhs_appAuthorization");
    return encrypted ? decryptData(encrypted) : "";
}

/** @param {unknown} value @returns {Record<string, any>} */
function asResponseRecord(value) {
    return value && "object" == typeof value ? /** @type {Record<string, any>} */ (value) : {};
}

/** 生成 JavDB API 请求签名 (HMAC-时间戳+盐+MD5, 20秒缓存) */
export function O() {
    const now = Math.floor(Date.now() / 1e3);
    if (signatureValue && now - signatureSecond <= 20) return signatureValue;
    signatureSecond = now;
    signatureValue = `${now}.lpw6vgqzsp.${md5(`${now}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return signatureValue;
}

/** 将影片加入当前 JavDB 账号的“想看”，使用与移动端功能相同的登录凭据。 */
export async function markJavDbWantWatch(/** @type {unknown} */ movieId) {
    const id = String(movieId || "").trim(), token = await readJavDbToken();
    if (!token) {
        throw Object.assign(new Error("请先登录 JavDB 账号"), { code: "LOGIN_REQUIRED" });
    }
    if (!id) throw new Error("JavDB 影片 ID 无效");
    const boundary = "----jhs-javdb-want-watch", body = [ [ "status", "want_watch" ], [ "score", "0" ], [ "content", "" ] ].map((([ name, value ]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)).join("") + `--${boundary}--\r\n`;
    try {
        const response = await gmHttp.gmRequest("POST", `${U}/v1/movies/${encodeURIComponent(id)}/reviews`, body, {}, {
            "user-agent": "Dart/3.5 (dart:io)",
            "accept-language": "zh-TW",
            authorization: `Bearer ${token}`,
            jdsignature: await O(),
            "content-type": `multipart/form-data; boundary=${boundary}`
        });
        if (0 === response?.success) throw response;
        await storageManager.deleteCachedRequest(`movie-detail:${id}`);
        wantWatchStateCache.set(id, true);
        return response;
    } catch (error) {
        const failure = asResponseRecord(error);
        if (401 === failure.status || "JWTVerificationError" === failure.action || /未登录|登录|unauthorized|jwt/i.test(failure.message || "")) {
            const runtime = /** @type {any} */ (globalThis);
            runtime.credentialService?.remove ? await runtime.credentialService.remove("jhs_appAuthorization") : localStorage.removeItem("jhs_appAuthorization");
            throw Object.assign(new Error("JavDB 登录已失效，请重新登录"), { code: "LOGIN_REQUIRED" });
        }
        throw error instanceof Error ? error : new Error(failure.message || "加入 JavDB 想看失败");
    }
}

/** Reads the authenticated account's current want-watch state; null means not logged in. */
export async function getJavDbWantWatchState(/** @type {unknown} */ movieId) {
    const id = String(movieId || "").trim(), token = await readJavDbToken();
    if (!token) return null;
    if (!id) throw new Error("JavDB 影片 ID 无效");
    if (wantWatchStateCache.has(id)) return wantWatchStateCache.get(id);
    const limit = 48;
    for (let page = 1; page <= 100; page++) {
        const url = `${U}/v2/users/review_movies?status=want_watch&type=0&sort_by=create&order_by=desc&page=${page}&limit=${limit}`;
        const response = await gmHttp.gmRequest("GET", url, null, {}, {
            "user-agent": "Dart/3.5 (dart:io)", "accept-language": "zh-TW", authorization: `Bearer ${token}`, jdsignature: await O()
        });
        const movies = response?.data?.movies ?? response?.movies;
        if (!Array.isArray(movies)) throw new Error("JavDB 想看状态响应无效");
        if (movies.some((/** @type {any} */ movie) => String(movie.id) === id)) return wantWatchStateCache.set(id, true), true;
        if (movies.length < limit) return wantWatchStateCache.set(id, false), false;
    }
    return false;
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
    if (!a.data) throw show.error("获取视频详情失败: " + a.message), new Error(a.message);
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
