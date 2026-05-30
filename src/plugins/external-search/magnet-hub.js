class Re extends X {
    constructor() {
        super(...arguments), i(this, "currentEngine", null), i(this, "searchEngines", [ {
            name: "U9A9",
            id: "u9a9",
            url: "https://u9a9.com/?type=2&search={keyword}",
            targetPage: "https://u9a9.com/?type=2&search={keyword}",
            parseHtml: this.parseTorrentList
        }, {
            name: "U3C3",
            id: "u3c3",
            url: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
            targetPage: "https://u3c3.com/?search2=a8lr16lo&search={keyword}",
            parseHtml: this.parseTorrentList
        }, {
            name: "Sukebei",
            id: "Sukebei",
            url: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
            targetPage: "https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}",
            parseHtml: this.parseTorrentList
        } ]);
    }
    getName() {
        return "MagnetHubPlugin";
    }
    async initCss() {
        return "\n            <style>\n                .magnet-container {\n                    margin: 20px auto;\n                    width: 100%;\n                    font-family: Arial, sans-serif;\n                }\n                .magnet-tabs {\n                    display: flex;\n                    border-bottom: 1px solid #ddd;\n                    margin-bottom: 15px;\n                    justify-content: space-between;\n                }\n                .magnet-tab {\n                    padding: 5px 12px;\n                    cursor: pointer;\n                    border: 1px solid transparent;\n                    border-bottom: none;\n                    margin-right: 5px;\n                    background: #f5f5f5;\n                    border-radius: 5px 5px 0 0;\n                }\n                .magnet-tab.active {\n                    background: #fff;\n                    border-color: #ddd;\n                    border-bottom: 1px solid #fff;\n                    margin-bottom: -1px;\n                    font-weight: bold;\n                }\n                .magnet-tab:hover:not(.active) {\n                    background: #e9e9e9;\n                }\n                \n                .magnet-results {\n                    min-height: 200px;\n                }\n                .magnet-result {\n                    padding: 15px;\n                    border-bottom: 1px solid #eee;\n                    position: relative; \n                }\n                .magnet-result:hover {\n                    background-color: #f9f9f9;\n                }\n                .magnet-title {\n                    font-weight: bold;\n                    margin-bottom: 5px;\n                    white-space: nowrap;\n                    overflow: hidden; \n                    text-overflow: ellipsis;\n                    padding-right: 80px; \n                }\n                .magnet-info {\n                    display: flex;\n                    justify-content: space-between;\n                    font-size: 12px;\n                    color: #666;\n                    margin-bottom: 5px;\n                }\n                .magnet-loading {\n                    text-align: center;\n                    padding: 20px;\n                }\n                .magnet-error {\n                    color: #f44336;\n                    padding: 10px;\n                }\n                \n                .magnet-copy {\n                    position: absolute;\n                    right: 15px;\n                    top: 12px;\n                }\n                .magnet-hub-btn {\n                    background-color: #f0f0f0;\n                    color: #555;\n                    border: 1px solid #ddd;\n                    padding: 3px 8px;\n                    border-radius: 3px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    transition: all 0.2s;\n                    margin-left: 10px;\n                }\n                .magnet-hub-btn:hover {\n                    background-color: #e0e0e0;\n                    border-color: #ccc;\n                }\n                .magnet-hub-btn.copied {\n                    background-color: #4CAF50;\n                    color: white;\n                    border-color: #4CAF50;\n                }\n            </style>\n        ";
    }
    createMagnetHub(e) {
        e = e.replace("FC2-", "");
        const t = $('<div class="magnet-container"></div>'), n = $('<div class="magnet-tabs"></div>'), a = "jhs_magnetHub_selectedEngine", i = localStorage.getItem(a);
        let s = 0;
        const o = $('<div style="display: flex;"></div>');
        this.searchEngines.forEach(((e, t) => {
            const n = $(`<div class="magnet-tab" data-engine="${e.id}">${e.name}</div>`);
            i && e.id === i ? (n.addClass("active"), this.currentEngine = e, s = t) : 0 !== t || i || (n.addClass("active"),
            this.currentEngine = e), o.append(n);
        })), n.append(o), n.append(`<a style="margin-right: 20px;margin-top:3px" id="targetBox" href="${this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))}" target="_blank">原网页</a>`),
        t.append(n);
        const r = $('<div class="magnet-results"></div>');
        return t.append(r), t.on("click", ".magnet-tab", (n => {
            const i = $(n.target).data("engine");
            this.currentEngine = this.searchEngines.find((e => e.id === i)), $("#targetBox").attr("href", this.currentEngine.targetPage.replace("{keyword}", encodeURIComponent(e))),
            localStorage.setItem(a, i), t.find(".magnet-tab").removeClass("active"), $(n.target).addClass("active"),
            this.searchEngine(r, this.currentEngine, e);
        })), this.searchEngine(r, this.currentEngine || this.searchEngines[s], e), t;
    }
    async searchEngine(e, t, n) {
        e.html(`<div class="magnet-loading">正在从 ${escapeHtml(t.name)} 搜索 "${escapeHtml(n)}"...</div>`);
        const a = `${t.name}_${n}`;
        if (t.parseHtml) try {
            const i = t.url.replace("{keyword}", encodeURIComponent(n)), s = await storageManager.cachedRequest(`magnet:${t.id}:${n}`, 216e5, (() => gmHttp.get(i).then((e => t.parseHtml.call(this, e, n)))));
            return void this.displayResults(e, s, t.name);
        } catch (s) {
            return void e.html(`<div class="magnet-error">解析 ${escapeHtml(t.name)} 结果失败: ${escapeHtml(s.message)}</div>`);
        }
        t.parseJson && await t.parseJson.call(this, e, t, n, a);
    }
    displayResults(e, t, n) {
        function a(e) {
            const t = e.text();
            e.addClass("copied").text("已复制"), setTimeout((() => {
                e.removeClass("copied").text(t);
            }), 2e3);
        }
        function i(e, t) {
            const n = document.createElement("textarea");
            n.value = e, n.style.position = "fixed", document.body.appendChild(n), n.select();
            try {
                document.execCommand("copy"), a(t);
            } catch (i) {
                console.error("复制失败:", i), alert("复制失败，请手动复制链接");
            }
            document.body.removeChild(n);
        }
        e.empty(), 0 !== t.length ? (t.forEach((e => { e._score = this.calcMagnetScore(e); })),
        t.sort(((e, t) => t._score.total - e._score.total)),
        t.forEach((t => {
            const n = t._score ? t._score.total : 0, a = n >= 80 ? "高" : n >= 60 ? "中" : "低", i = t._score ? `做种:${t._score.seeders}/35 分辨率:${t._score.resolution}/25 字幕:${t._score.subtitle}/20 新鲜度:${t._score.freshness}/15 完整性:${t._score.completeness}/5` : "";
            const safeTitle = escapeHtml(t.title), safeMagnet = escapeHtml(t.magnet);
            $(`\n                <div class="magnet-result">\n                    <div class="magnet-title">\n                        <span class="magnet-score" title="${i}" style="cursor:help;font-size:14px;margin-right:6px;">${a} ${n}</span>\n                        <a href="${safeMagnet}">${safeTitle}</a>\n                    </div>\n                    <div class="magnet-info">\n                        <span>大小: ${t.size || "未知"}</span>\n                        <span>做种: ${t.seeders || "—"}</span>\n                        <span>日期: ${t.date || "未知"}</span>\n                    </div>\n                    <div class="magnet-copy">\n                        <button class="magnet-hub-btn copy-btn" data-magnet="${safeMagnet}">复制链接</button>\n                    </div>\n                </div>\n            `).find(".magnet-copy").append(`<button class="magnet-hub-btn one23-offline-btn" data-magnet="${safeMagnet}">123离线</button>`).end().appendTo(e);
        })), e.on("click", ".copy-btn", (function() {
            const e = $(this), t = e.data("magnet");
            navigator.clipboard ? navigator.clipboard.writeText(t).then((() => {
                a(e);
            })).catch((n => {
                i(t, e);
            })) : i(t, e);
        }))) : e.append('<div class="magnet-error">没有找到相关结果</div>');
    }
    async parseBTSOW(e, t, n, a) {
        try {
            const i = await gmHttp.post(t.url, [{ search: n }, 50, 1]), s = i.data || [], o = [];
            for (let e = 0; e < s.length; e++) {
                let t = s[e];
                o.push({
                    title: t.name,
                    magnet: "magnet:?xt=urn:btih:" + t.hash,
                    size: (t.size / 1073741824).toFixed(2) + " GB",
                    date: utils.formatDate(new Date(1e3 * t.lastUpdateTime))
                });
            }
            o.length > 0 && this.displayResults(e, o, t.name);
        } catch (i) {
            e.html(`<div class="magnet-error">从 ${escapeHtml(t.name)} 获取数据失败: ${escapeHtml(String(i.message || i))}</div>`);
        }
    }
    parseTorrentList(e, t) {
        const n = utils.htmlTo$dom(e), a = [];
        return n.find(".torrent-list tbody tr").each(((e, n) => {
            const i = $(n);
            if (i.text().includes("置顶")) return;
            const s = i.find("td:nth-child(2) a").attr("title") || i.find("td:nth-child(2) a").text().trim();
            if (!s.toLowerCase().includes(t.toLowerCase())) return;
            const o = i.find("td:nth-child(3) a[href^='magnet:']").attr("href"), r = i.find("td:nth-child(4)").text().trim(), l = i.find("td:nth-child(5)").text().trim(), c = parseInt(i.find("td:nth-child(6)").text().trim()) || 0, d = parseInt(i.find("td:nth-child(7)").text().trim()) || 0;
            o && a.push({
                title: s,
                magnet: o,
                size: r,
                date: l,
                seeders: c,
                leechers: d
            });
        })), a;
    }
    calcMagnetScore(e) {
        let t = 0;
        const n = (e.seeders || 0);
        const seedersScore = n >= 50 ? 35 : n >= 10 ? 25 : n >= 1 ? 15 : 3;
        t += seedersScore;
        const a = (e.title || "").toLowerCase();
        const resolutionScore = /4k|2160p/.test(a) ? 25 : /1080p/.test(a) ? 20 : /720p/.test(a) ? 15 : 5;
        t += resolutionScore;
        const subtitleScore = /-c\b|-uc\b|chinese|中字|字幕/.test(a) ? 20 : 0;
        t += subtitleScore;
        const i = e.date ? this._daysSince(e.date) : 999;
        const freshnessScore = i <= 7 ? 15 : i <= 30 ? 12 : i <= 90 ? 8 : 3;
        t += freshnessScore;
        const completenessScore = /sample|预告|trailer/.test(a) ? -15 : 0;
        t += completenessScore;
        return { total: Math.max(0, Math.min(100, t)), seeders: seedersScore, resolution: resolutionScore, subtitle: subtitleScore, freshness: freshnessScore, completeness: completenessScore };
    }
    _daysSince(e) {
        try {
            const t = new Date(e);
            if (isNaN(t.getTime())) return 999;
            return Math.max(0, Math.floor((Date.now() - t.getTime()) / 864e5));
        } catch (t) { return 999; }
    }
}
