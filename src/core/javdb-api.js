// @ts-check

let signatureSecond = 0, signatureValue = "";

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
