const U = "https://jdforrepam.com/api";

/** 生成 JavDB API 请求签名 (HMAC-时间戳+盐+MD5, 20秒缓存) */
function O() {
    const e = "jhs_review_ts", t = "jhs_review_sign", n = Math.floor(Date.now() / 1e3);
    if (n - (localStorage.getItem(e) || 0) <= 20) return localStorage.getItem(t);
    const a = `${n}.lpw6vgqzsp.${md5(`${n}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return localStorage.setItem(e, n), localStorage.setItem(t, a), a;
}

const R = async (e, t = 1, n = 20) => {
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
