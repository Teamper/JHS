// @ts-check

/** @param {Record<string, any>} magnet */
export function calcMagnetScore(magnet) {
    let total = 0;
    const seeders = Number(magnet.seeders) || 0;
    const seedersScore = seeders >= 50 ? 35 : seeders >= 10 ? 25 : seeders >= 1 ? 15 : 3;
    total += seedersScore;
    const title = String(magnet.title || "").toLowerCase(), resolution = String(magnet.resolution || "").toLowerCase();
    const resolutionScore = /4k|2160p/.test(resolution) || /4k|2160p/.test(title) ? 25 : /1080p/.test(resolution) || /1080p/.test(title) ? 20 : /720p/.test(resolution) || /720p/.test(title) ? 15 : 5;
    total += resolutionScore;
    const subtitleScore = magnet.hasSubtitle || /-c\b|-uc\b|chinese|中字|字幕/.test(title) ? 20 : 0;
    total += subtitleScore;
    const days = daysSince(magnet.date), freshnessScore = days <= 7 ? 15 : days <= 30 ? 12 : days <= 90 ? 8 : 3;
    total += freshnessScore;
    const completenessScore = /sample|预告|trailer/.test(title) ? -15 : 0;
    total += completenessScore;
    return { total: Math.max(0, Math.min(100, total)), seeders: seedersScore, resolution: resolutionScore, subtitle: subtitleScore, freshness: freshnessScore, completeness: completenessScore };
}

/** @param {unknown} value */
function daysSince(value) {
    try { const date = new Date(String(value || "")); return Number.isNaN(date.getTime()) ? 999 : Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000)); } catch { return 999; }
}

/** @param {unknown} title @param {boolean} [hasSubtitleTag] */
export function getMagnetQualitySignals(title, hasSubtitleTag = false) {
    const value = String(title || "").toLowerCase(), resolution = /(?:4k|2160p|1080p|720p)/.exec(value)?.[0] || "", subtitle = hasSubtitleTag || /(?:-c\b|-u(?:c)?\b|chinese|中字|字幕)/.test(value);
    return { resolution, subtitle, recognized: Boolean(resolution) || subtitle, highQuality: resolution === "4k" || resolution === "2160p" || subtitle };
}

/** @param {{title?: unknown, hasHdTag?: boolean, hasSubtitleTag?: boolean, date?: unknown, seeders?: number}} magnet */
export function assessMagnetQuality({ title = "", hasHdTag = false, hasSubtitleTag = false, date = null, seeders = 0 } = {}) {
    const signals = getMagnetQualitySignals(title, hasSubtitleTag), highQuality = hasHdTag || signals.highQuality;
    const score = calcMagnetScore({ title, date, seeders, resolution: hasHdTag && !signals.resolution ? "1080p" : signals.resolution, hasSubtitle: signals.subtitle });
    return { ...signals, highQuality, score, grade: score.total >= 70 ? "高" : score.total >= 40 ? "中" : "低" };
}
