class ActressInfoPlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "apiUrl", "https://ja.wikipedia.org/wiki/");
    }
    getName() {
        return "ActressInfoPlugin";
    }
    async handle() {
        "yes" === await storageManager.getSetting("enableLoadActressInfo", "yes") && this.loadActressInfo();
    }
    loadActressInfo() {
        this.handleDetailPage().then(), this.handleStarPage().then();
    }
    async initCss() {
        return "\n            <style>\n                .info-tag {\n                    background-color: var(--jhs-status-fav-tint);\n                    display: inline-block;\n                    height: 32px;\n                    padding: 0 10px;\n                    line-height: 30px;\n                    font-size: 12px;\n                    color: var(--jhs-status-fav);\n                    border: 1px solid var(--jhs-status-fav-tint);\n                    border-radius: 4px;\n                    box-sizing: border-box;\n                    white-space: nowrap;\n                }\n            </style>\n        ";
    }
    async handleDetailPage() {
        if ($(".actress-info").length > 0) return;
        let e = $(".female").prev().map(((e, t) => $(t).text().trim())).get();
        if (!e.length) return;
        const t = "jhs_actress_info", n = localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {};
        let a = null, i = "";
        for (let o = 0; o < e.length; o++) {
            let t = e[o];
            if (a = n[t], !a) try {
                a = await this.searchInfo(t), a && (n[t] = a);
            } catch (s) {
                console.error("该名称查询失败,尝试其它名称");
            }
            let r = "";
            r = a ? `\n                    <div class="panel-block actress-info">\n                        <strong>${t}:</strong>\n                        <a href="${a.url}" target="_blank" class="jhs-layout-9813a0dd">\n                            <span class="info-tag">${a.birthday} ${a.age}</span>\n                            <span class="info-tag">${a.height} ${a.weight}</span>\n                            <span class="info-tag">${a.threeSizeText} ${a.braSize}</span>\n                        </a>\n                    </div>\n                ` : `<div class="panel-block actress-info"><a href="${this.apiUrl + t}" target="_blank"><strong>${t}:</strong></a></div> `,
            i += r;
        }
        $('strong:contains("演員")').parent().after(i), localStorage.setItem(t, JSON.stringify(n));
    }
    async handleStarPage() {
        if ($(".actress-info").length > 0) return;
        let e = [], t = $(".actor-section-name");
        t.length && t.text().trim().split(",").forEach((t => {
            e.push(t.trim());
        }));
        let n = $(".section-meta:not(:contains('影片'))");
        if (n.length && n.text().trim().split(",").forEach((t => {
            e.push(t.trim());
        })), !e.length) return;
        const a = "jhs_actress_info", i = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {};
        let s = null;
        for (let l = 0; l < e.length; l++) {
            let t = e[l];
            if (s = i[t], s) break;
            try {
                s = await this.searchInfo(t);
            } catch (r) {
                console.error("该名称查询失败,尝试其它名称");
            }
            if (s) break;
        }
        s && e.forEach((e => {
            i[e] = s;
        }));
        let o = '<div class="actress-info jhs-layout-c0d4a511">无此相关演员信息</div>';
        s && (o = `\n                <a class="actress-info" href="${s.url}" target="_blank">\n                    <div class="jhs-layout-c0d4a511">\n                        <div class="jhs-layout-1b3790ef">\n                            <span class="jhs-layout-dd5a75f6">出生日期: ${s.birthday}</span>\n                            <span class="jhs-layout-d4a09a0d">年龄: ${s.age}</span>\n                            <span class="jhs-layout-d4a09a0d">身高: ${s.height}</span>\n                        </div>\n                        <div class="jhs-layout-1b3790ef">\n                            <span class="jhs-layout-dd5a75f6">体重: ${s.weight}</span>\n                            <span class="jhs-layout-d4a09a0d">三围: ${s.threeSizeText}</span>\n                            <span class="jhs-layout-d4a09a0d">罩杯: ${s.braSize}</span>\n                        </div>\n                    </div>\n                </a>\n            `),
        t.parent().append(o), localStorage.setItem(a, JSON.stringify(i));
    }
    async searchInfo(e) {
        "三上悠亞" === e && (e = "三上悠亜");
        let t = this.apiUrl + e;
        const n = await gmHttp.get(t), a = new DOMParser, i = $(a.parseFromString(n, "text/html"));
        let s = i.find('a[title="誕生日"]').parent().parent().find("td").text().trim(), o = i.find("th:contains('現年齢')").parent().find("td").text().trim() ? parseInt(i.find("th:contains('現年齢')").parent().find("td").text().trim()) + "岁" : "", r = i.find('tr:has(a[title="身長"]) td').text().trim().split(" ")[0] + "cm", l = i.find('tr:has(a[title="体重"]) td').text().trim().split("/")[1].trim();
        return "― kg" === l && (l = ""), {
            birthday: s,
            age: o,
            height: r,
            weight: l,
            threeSizeText: i.find('a[title="スリーサイズ"]').closest("tr").find("td").text().replace("cm", "").trim(),
            braSize: i.find('th:contains("ブラサイズ")').next("td").contents().first().text().trim(),
            url: t
        };
    }
}
