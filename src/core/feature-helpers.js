/** 以固定并发执行任务，保持输入顺序。 */
async function mapLimit(items, concurrency = 4, mapper) {
    const results = new Array(items.length); let cursor = 0;
    const worker = async () => { while (cursor < items.length) { const index = cursor++; results[index] = await mapper(items[index], index); } };
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
    return results;
}

/** 读取数值配置，保留合法的 0 并按范围回退默认值。 */
function parseNumberSetting(value, fallback, { min = -Infinity, max = Infinity } = {}) {
    if (null == value || "" === String(value).trim()) return fallback;
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

/** 将旧日期字符串或毫秒时间戳统一解析为 Unix 毫秒。 */
function parseTaskTimestamp(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if ("number" == typeof value) return Number.isFinite(value) && value >= 0 ? value : null;
    if ("string" != typeof value) return null;
    const text = value.trim();
    if (!text) return null;
    if (/^\d{13,16}$/.test(text)) {
        const timestamp = Number(text);
        return Number.isFinite(timestamp) ? timestamp : null;
    }
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
        const parts = match.slice(1).map(Number), date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
        return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2]
            && date.getHours() === parts[3] && date.getMinutes() === parts[4] && date.getSeconds() === parts[5] ? date.getTime() : null;
    }
    const timestamp = new Date(text).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

/** 判断最近发行时间是否已超出停更规则窗口。 */
function shouldSkipStopped(lastPublishTime, ruleHours, now = Date.now()) {
    const hours = parseNumberSetting(ruleHours, 0, { min: 0 }), publishedAt = parseTaskTimestamp(lastPublishTime), nowAt = parseTaskTimestamp(now);
    return hours > 0 && null != publishedAt && null != nowAt && nowAt >= publishedAt && nowAt - publishedAt >= 36e5 * hours;
}

/** 从一组发行日期中选择真实时间最大的原始值。 */
function selectLatestPublishTime(values) {
    let latestValue = null, latestAt = -Infinity;
    for (const value of values) {
        const timestamp = parseTaskTimestamp(value);
        null != timestamp && timestamp > latestAt && (latestAt = timestamp, latestValue = value);
    }
    return latestValue;
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
