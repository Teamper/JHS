import { normalizeCarNum } from "./constants.js";
import { decryptData } from "../plugins/image-viewer/bus-preview-video.js";

export const U = "https://jdforrepam.com/api";
const javDbMovieIdRequests = new Map();

/** 生成 JavDB API 请求签名 (HMAC-时间戳+盐+MD5, 20秒缓存) */
export function O() {
    const e = "jhs_review_ts", t = "jhs_review_sign", n = Math.floor(Date.now() / 1e3);
    if (n - (localStorage.getItem(e) || 0) <= 20) return localStorage.getItem(t);
    const a = `${n}.lpw6vgqzsp.${md5(`${n}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return localStorage.setItem(e, n), localStorage.setItem(t, a), a;
}

/** 按规范化番号精确解析 JavDB movieId，并合并同番号并发请求。 */
export async function resolveJavDbMovieId(carNum) {
    const normalized = normalizeCarNum(carNum);
    if (!normalized) return null;
    if (javDbMovieIdRequests.has(normalized)) return javDbMovieIdRequests.get(normalized);
    const request = storageManager.cachedRequest(`javdb-movie-id:${normalized}`, 7 * 864e5, (async () => {
        const response = await gmHttp.get(`${U}/v2/search`, {
            q: normalized,
            page: 1,
            type: "movie",
            limit: 20,
            movie_type: "all",
            from_recent: "false",
            movie_filter_by: "all",
            movie_sort_by: "relevance"
        }, {
            "user-agent": "Dart/3.5 (dart:io)",
            "accept-language": "zh-TW",
            host: "jdforrepam.com",
            jdsignature: await O()
        });
        if (!Array.isArray(response?.data?.movies)) throw new Error(response?.message || "JavDB 番号解析失败");
        const match = response.data.movies.find((movie => normalizeCarNum(movie.number) === normalized));
        return match?.id ? { __jhsCacheTtl: 7 * 864e5, data: { movieId: String(match.id) } } : { __jhsCacheTtl: 6 * 36e5, data: { miss: !0 } };
    })).then((value => value?.miss ? null : value?.movieId || null));
    javDbMovieIdRequests.set(normalized, request);
    try {
        return await request;
    } finally {
        javDbMovieIdRequests.get(normalized) === request && javDbMovieIdRequests.delete(normalized);
    }
}

/** 将影片加入当前 JavDB 账号的“想看”，使用与移动端功能相同的登录凭据。 */
export async function markJavDbWantWatch(movieId) {
    const id = String(movieId || "").trim(), encryptedToken = localStorage.getItem("jhs_appAuthorization"), token = encryptedToken ? await decryptData(encryptedToken) : "";
    if (!token) {
        const error = new Error("请先登录 JavDB 账号");
        throw error.code = "LOGIN_REQUIRED", error;
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
        return response;
    } catch (error) {
        if (401 === error?.status || "JWTVerificationError" === error?.action || /未登录|登录|unauthorized|jwt/i.test(error?.message || "")) {
            localStorage.removeItem("jhs_appAuthorization");
            const loginError = new Error("JavDB 登录已失效，请重新登录");
            throw loginError.code = "LOGIN_REQUIRED", loginError;
        }
        throw error instanceof Error ? error : new Error(error?.message || "加入 JavDB 想看失败");
    }
}

export const R = async (e, t = 1, n = 20) => {
    let a = `${U}/v1/movies/${e}/reviews`, i = {
        jdSignature: await O()
    };
    return await storageManager.cachedRequest(`reviews:${e}:${t}:${n}`, 864e5, (async () => {
        const e = await gmHttp.get(a, {
            page: t,
            sort_by: "hotly",
            limit: n
        }, i);
        if (!e?.data?.reviews) throw new Error(e?.message || "获取评论失败");
        return e.data.reviews;
    }));
}, V = async e => {
    let t = `${U}/v4/movies/${e}`, n = {
        jdSignature: await O()
    };
    const a = await storageManager.cachedRequest(`movie-detail:${e}`, 6048e5, (async () => {
        const e = await gmHttp.get(t, null, n);
        if (!e.data) throw new Error(e.message || "获取视频详情失败");
        return e;
    }));
    if (!a.data) throw show.error("获取视频详情失败: " + a.message), new Error(a.message);
    const i = a.data.movie, s = i.preview_images, o = [];
    return s.forEach((e => {
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
}, K = async (e, t = 1, n = 20) => {
    let a = `${U}/v1/lists/related?movie_id=${e}&page=${t}&limit=${n}`, i = {
        jdSignature: await O()
    };
    const s = await storageManager.cachedRequest(`related:${e}:${t}:${n}`, 864e5, (async () => {
        const e = await gmHttp.get(a, null, i);
        if (!e?.data?.lists) throw new Error(e?.message || "获取相关清单失败");
        return e;
    })), o = [];
    return s.data.lists.forEach((e => {
        o.push({
            relatedId: e.id,
            name: e.name,
            movieCount: e.movies_count,
            collectionCount: e.collections_count,
            viewCount: e.views_count,
            createTime: utils.formatDate(e.created_at)
        });
    })), o;
}, W = async (e = "daily", t = "high_score") => {
    let n = `${U}/v1/rankings/playback?period=${e}&filter_by=${t}`, a = {
        jdSignature: await O()
    };
    return (await gmHttp.get(n, null, a)).data.movies;
}, q = async (e = "all", t = "", n = 1, a = 40) => {
    let i = `${U}/v1/movies/top?start_rank=1&type=${e}&type_value=${t}&ignore_watched=false&page=${n}&limit=${a}`;
    const l = localStorage.getItem("jhs_appAuthorization"), c = l ? await decryptData(l) : "";
    let s = {
        "user-agent": "Dart/3.5 (dart:io)",
        "accept-language": "zh-TW",
        host: "jdforrepam.com",
        authorization: "Bearer " + c,
        jdsignature: await O()
    };
    return await gmHttp.get(i, null, s);
};
