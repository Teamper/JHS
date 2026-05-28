class He extends X {
    constructor() {
        super(...arguments), i(this, "floorIndex", 1), i(this, "isInit", !1);
    }
    getName() {
        return "RelatedPlugin";
    }
    async showRelated(e, t) {
        const n = await storageManager.getSetting("enableLoadRelated", C), a = e;
        t ? (a.append(`\n            <div style="display: flex; align-items: center; margin: 16px 0; color: #666; font-size: 14px;">\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n                <span style="padding: 0 10px;">相关清单</span>\n                <a id="relatedFold" style="margin-left: 8px; color: #1890ff; text-decoration: none; display: flex; align-items: center;">\n                    <span class="toggle-text">${n === _ ? "折叠" : "展开"}</span>\n                    <span class="toggle-icon" style="margin-left: 4px;">${n === _ ? "▲" : "▼"}</span>\n                </a>\n                <span style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #999, transparent);"></span>\n            </div>\n        `),
        $("#relatedFold").on("click", (e => {
            e.preventDefault(), e.stopPropagation();
            const n = $("#relatedFold .toggle-text"), a = $("#relatedFold .toggle-icon"), i = "展开" === n.text();
            n.text(i ? "折叠" : "展开"), a.text(i ? "▲" : "▼"), i ? ($("#relatedContainer").show(),
            $("#relatedFooter").show(), this.isInit || (this.fetchAndDisplayRelateds(t), this.isInit = !0),
            storageManager.saveSettingItem("enableLoadRelated", _)) : ($("#relatedContainer").hide(),
            $("#relatedFooter").hide(), storageManager.saveSettingItem("enableLoadRelated", C));
        })), a.append('<div id="relatedContainer"></div>'), a.append('<div id="relatedFooter"></div>'),
        n === _ && await this.fetchAndDisplayRelateds(t)) : show.error("未传入movieId");
    }
    async fetchAndDisplayRelateds(e) {
        const t = $("#relatedContainer"), n = $("#relatedFooter");
        t.append('<div id="relatedLoading" style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">获取清单中...</div>');
        let a = null;
        try {
            a = await K(e, 1, 20);
        } catch (i) {
            console.error("获取清单失败:", i);
        } finally {
            $("#relatedLoading").remove();
        }
        if (!a) return t.append('\n                <div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">\n                    获取清单失败\n                    <a id="retryFetchRelateds" href="javascript:;" style="margin-left: 10px; color: #1890ff; text-decoration: none;">重试</a>\n                </div>\n            '),
        void $("#retryFetchRelateds").on("click", (async () => {
            $("#retryFetchRelateds").parent().remove(), await this.fetchAndDisplayRelateds(e);
        }));
        if (0 !== a.length) if (this.displayRelateds(a, t), 20 === a.length) {
            n.html('\n                <button id="loadMoreRelateds" style="width:100%; background-color: #e1f5fe; border:none; padding:10px; margin-top:10px; cursor:pointer; color:#0277bd; font-weight:bold; border-radius:4px;">\n                    加载更多清单\n                </button>\n                <div id="relatedEnd" style="display:none; text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部清单</div>\n            ');
            let a = 1, s = $("#loadMoreRelateds");
            s.on("click", (async () => {
                let n;
                s.text("加载中...").prop("disabled", !0), a++;
                try {
                    n = await K(e, a, 20);
                } catch (i) {
                    console.error("加载更多清单失败:", i);
                } finally {
                    s.text("加载失败, 请点击重试").prop("disabled", !1);
                }
                n && (this.displayRelateds(n, t), n.length < 20 ? (s.remove(), $("#relatedEnd").show()) : s.text("加载更多清单").prop("disabled", !1));
            }));
        } else n.html('<div style="text-align:center; padding:10px; color:#666; margin-top:10px;">已加载全部清单</div>'); else t.append('<div style="margin-top:15px;background-color:#ffffff;padding:10px;margin-left: -10px;">无清单</div>');
    }
    displayRelateds(e, t) {
        e.length && e.forEach((e => {
            let n = `\n                <div class="item columns is-desktop" style="display:block;margin-top:6px;background-color:#ffffff;padding:10px;margin-left: -10px;word-break: break-word;position:relative;">\n                   <span style="position:absolute;top:5px;right:10px;color:#999;font-size:12px;">#${this.floorIndex++}</span>\n                   <span style="position:absolute;bottom:5px;right:10px;color:#999;font-size:12px;">创建时间: ${e.createTime}</span>\n                   <p><a href="/lists/${e.relatedId}" target="_blank" style="color:#2e8abb">${e.name}</a></p>\n                   <p style="margin-top: 5px;">视频个数: ${e.movieCount}</p>\n                   <p style="margin-top: 5px;">收藏次数: ${e.collectionCount} 被查看次数: ${e.viewCount}</p>\n                </div>\n            `;
            t.append(n);
        }));
    }
}
