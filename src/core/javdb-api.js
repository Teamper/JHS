import { decryptData } from "./credential-crypto.js";

export const U = "https://jdforrepam.com/api";
let signatureSecond = 0, signatureValue = "";

/** 生成 JavDB API 请求签名 (HMAC-时间戳+盐+MD5, 20秒缓存) */
export function O() {
    const now = Math.floor(Date.now() / 1e3);
    if (signatureValue && now - signatureSecond <= 20) return signatureValue;
    signatureSecond = now;
    signatureValue = `${now}.lpw6vgqzsp.${md5(`${now}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return signatureValue;
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

export const V = async e => {
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
