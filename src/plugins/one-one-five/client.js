class OneOneFiveClient {
    constructor(http = gmHttp) { this.http = http; }
    async checkLogin() {
        try { const result = await this.http.get("https://webapi.115.com/offine/downpath"); return Boolean(result?.state && result?.data?.length); } catch (cause) { throw new ProviderError("115", "LOGIN_REQUIRED", "115 未登录", { cause }); }
    }
    async search(keyword, offset = 0, limit = 50) {
        const result = await this.http.get(`https://webapi.115.com/files/search?search_value=${encodeURIComponent(keyword)}&offset=${offset}&limit=${limit}`);
        return (result?.data || []).map((item => ({ folderId: item.pid || item.cid || "", fileId: item.fid || null, videoId: item.pc || item.pick_code || "", name: item.n || item.file_name || "", size: Number(item.s || item.size) || 0, createTime: item.t || item.create_time || "", isVideo: /\.(mp4|mkv|avi|mov|flv|wmv|ts|m2ts)$/i.test(item.n || item.file_name || "") }))).filter((item => item.isVideo));
    }
    async getOfflineInfo() { return this.http.get(`https://115.com/?ct=offline&ac=space&_=${Date.now()}`); }
    async addOffline(magnet, folderId = "") {
        if (!/^magnet:/i.test(magnet) && !/^ed2k:/i.test(magnet)) throw new TypeError("Unsupported offline URL");
        const info = await this.getOfflineInfo();
        if (!info || !info.sign) throw new ProviderError("115", "LOGIN_REQUIRED", "115 未登录或离线空间信息获取失败");
        const body = new URLSearchParams({ url: magnet, wp_path_id: folderId, uid: String(info.uid || ""), sign: info.sign || "", time: String(info.time || "") }).toString();
        const result = await this.http.gmRequest("POST", "https://115.com/web/lixian/?ct=lixian&ac=add_task_url", body, {}, { "Content-Type": "application/x-www-form-urlencoded" });
        const parsed = "string" == typeof result ? (() => { try { return JSON.parse(result); } catch { return { state: !1, error_msg: /login|登录|sign in|未授权|授权|expire|expired|token|cookie/i.test(result) ? "115 未登录" : "115 返回异常响应" }; } })() : result;
        if (!parsed || parsed.state === !1) {
            const message = String(parsed?.error_msg || parsed?.error || parsed?.msg || "");
            const code = this.classifyAddOfflineError(message);
            throw new ProviderError("115", code, message || "115 离线任务创建失败", { response: parsed });
        }
        return parsed;
    }
    classifyAddOfflineError(message) {
        const text = String(message).toLowerCase();
        if (/未登录|请登录|登录|login|sign|授权|过期|invalid|token|cookie|uid|身份|auth|expire|needlogin|need login/i.test(text)) return "LOGIN_REQUIRED";
        if (/已存在|重复|exists|duplicate|already|same|conflict|exist/i.test(text)) return "TASK_EXISTS";
        return "ADD_TASK_FAILED";
    }
    async rename(fileId, newName) {
        const body = new URLSearchParams({ fid: fileId, file_name: newName }).toString();
        return this.http.gmRequest("POST", "https://webapi.115.com/files/edit", body, {}, { "Content-Type": "application/x-www-form-urlencoded" });
    }
}

function normalize115Keyword(carNum) { const normalized = normalizeCarNum(carNum); return normalized?.replace(/^FC2-/i, "") || null; }
function build115PlayUrl(match) { return match?.videoId ? `https://115.com/?ct=play&pickcode=${encodeURIComponent(match.videoId)}` : null; }
function format115Size(bytes) { const value = Number(bytes) || 0; if (!value) return "0 B"; const units = ["B", "KB", "MB", "GB", "TB"], index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024))); return `${(value / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`; }
function preview115Rename(fileName, carNum, options = {}) {
    const extension = fileName.match(/\.[^.]+$/)?.[0] || "", tags = fileName.match(/-(?:U|UC|C|4K|8K|H265|HEVC|CN|CHS|CHT)\b/gi) || [];
    let base = options.uppercase === false ? carNum : carNum.toUpperCase();
    if (options.keepTitle) base += ` ${fileName.replace(extension, "").replace(/^.*?\s+/, "")}`;
    if (options.keepSuffix !== false) base += [...new Set(tags.map((tag => tag.toUpperCase())))].join("");
    return `${base.slice(0, options.maxLength || 180)}${extension}`;
}
