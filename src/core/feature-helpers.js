/** 以固定并发执行任务，保持输入顺序。 */
async function mapLimit(items, concurrency = 4, mapper) {
    const results = new Array(items.length); let cursor = 0;
    const worker = async () => { while (cursor < items.length) { const index = cursor++; results[index] = await mapper(items[index], index); } };
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
    return results;
}

function normalizeDmmCid(carNum) {
    const compact = (normalizeCarNum(carNum) || "").replace(/[-_\s]/g, "").toLowerCase();
    if (!compact) return [];
    const candidates = [compact];
    const match = compact.match(/^([a-z]+)(\d+)$/);
    if (match) candidates.push(`${match[1]}00${match[2]}`, `${match[1]}0${match[2]}`);
    return [...new Set(candidates)];
}

/** 将外部地址规范为可安全写入链接或媒体属性的 HTTP(S) URL。 */
function normalizeHttpUrl(value, baseUrl = window.location.href) {
    if (!value) return null;
    try {
        const url = new URL(String(value), baseUrl);
        return [ "http:", "https:" ].includes(url.protocol) ? url.href : null;
    } catch (error) {
        clog.debug("外部 URL 无效，已忽略", error);
        return null;
    }
}

/** 规范 BTIH，兼容 40 位十六进制与 32 位 Base32。 */
function normalizeBtihHash(value) {
    const hash = String(value || "").trim();
    return /^(?:[a-f\d]{40}|[a-z2-7]{32})$/i.test(hash) ? hash.toUpperCase() : null;
}

function resolveHighResCover(value) {
    if (!value) return null;
    const url = new URL(value, window.location.href);
    url.pathname = url.pathname.replace("/thumbs/", "/covers/").replace(/\/ps\.(jpg|jpeg|png)$/i, "/pl.$1").replace("https://www.prestige-av.com/images/corner/goods", "https://image.mgstage.com/images");
    return url.href;
}

function parseCarNumberText(text) {
    const tokens = String(text || "").split(/[\s,，;；]+/).map((item => normalizeCarNum(item))).filter(Boolean);
    const valid = tokens.filter((item => /^(?:FC2-)?[A-Z\d]+(?:-[A-Z\d]+)+$/i.test(item)));
    return { recognized: tokens.length, values: [...new Set(valid.map((item => item.toUpperCase())))], invalid: tokens.filter((item => !valid.includes(item))) };
}

function buildFallbackCarUrl(carNum, baseUrl = "https://javdb.com") { return `${baseUrl}/search?q=${encodeURIComponent(carNum)}`; }

function linkCommentImageReferences(text, imageCount) {
    const chinese = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    return String(text).replace(/(?:图|图片)\s*([一二三四五六七八九十]|\d+)/g, ((match, value) => {
        const index = chinese[value] || Number(value);
        return index >= 1 && index <= imageCount ? `<button type="button" class="jhs-btn jhs-btn--ghost jhs-comment-image-link" data-image-index="${index - 1}">${escapeHtml(match)}</button>` : match;
    }));
}

/** 安全播放媒体，统一处理浏览器播放拒绝并返回是否成功。 */
async function safePlay(mediaElement, { context = "视频", notify = !1, message = "当前视频源无法播放" } = {}) {
    if (!mediaElement || "function" != typeof mediaElement.play) {
        clog.warn(`${context}播放失败：媒体元素不可用`);
        notify && show.error(message);
        return !1;
    }
    try {
        await mediaElement.play();
        return !0;
    } catch (error) {
        clog.warn(`${context}播放失败`, error);
        const name = error?.name || "";
        notify && ![ "NotAllowedError", "AbortError" ].includes(name) && show.error(message);
        return !1;
    }
}
