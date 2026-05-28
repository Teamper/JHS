class De {
    constructor(e, t, n) {
        this.davUrl = e.endsWith("/") ? e : e + "/", this.username = t, this.password = n,
        this.folderName = null;
    }
    _getAuthHeaders() {
        return {
            Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
            Depth: "1"
        };
    }
    _sendRequest(e, t, n = {}, a) {
        return new Promise(((i, s) => {
            const o = this.davUrl + t, r = {
                ...this._getAuthHeaders(),
                ...n
            };
            GM_xmlhttpRequest({
                method: e,
                url: o,
                headers: r,
                data: a,
                onload: e => {
                    e.status >= 200 && e.status < 300 ? i(e) : (console.error(e), s(new Error(`请求失败 ${e.status}: ${e.statusText}`)));
                },
                onerror: e => {
                    console.error("请求WebDav发生错误:", e), s(new Error("请求WebDav失败, 请检查服务是否启动, 凭证是否正确"));
                }
            });
        }));
    }
    async _ensureFolder(e) {
        try {
            await this._sendRequest("MKCOL", e);
        } catch (t) {
            if (!/请求失败 (405|409):/.test(t.message)) throw t;
        }
    }
    async backup(e, t, n) {
        await this._ensureFolder(e);
        const a = e + "/" + t;
        await this._sendRequest("PUT", a, {
            "Content-Type": "text/plain"
        }, n);
    }
    async getFileList(e) {
        var t, n, a;
        const i = (await this._sendRequest("PROPFIND", e, {
            "Content-Type": "application/xml"
        }, '<?xml version="1.0"?>\n                <d:propfind xmlns:d="DAV:">\n                    <d:prop>\n                        <d:displayname />\n                        <d:getcontentlength />\n                        <d:creationdate />\n                        <d:getlastmodified />\n                        <d:iscollection />\n                    </d:prop>\n                </d:propfind>\n            ')).responseText, s = (new DOMParser).parseFromString(i, "text/xml").getElementsByTagNameNS("DAV:", "response"), o = [];
        for (let r = 0; r < s.length; r++) {
            if (0 === r) continue;
            let e = s[r];
            const i = e.getElementsByTagNameNS("DAV:", "displayname")[0].textContent, l = (null == (t = e.getElementsByTagNameNS("DAV:", "getcontentlength")[0]) ? void 0 : t.textContent) || "0", c = (null == (n = e.getElementsByTagNameNS("DAV:", "creationdate")[0]) ? void 0 : n.textContent) || (null == (a = e.getElementsByTagNameNS("DAV:", "getlastmodified")[0]) ? void 0 : a.textContent) || "";
            "0" !== l && o.push({
                fileId: i,
                name: i,
                size: Number(l),
                createTime: c
            });
        }
        return o.reverse(), o;
    }
    async deleteFile(e) {
        let t = this.folderName + "/" + encodeURI(e);
        await this._sendRequest("DELETE", t, {
            "Cache-Control": "no-cache"
        });
    }
    async getBackupList(e) {
        return this.folderName = e, await this._ensureFolder(e), this.getFileList(e);
    }
    async getFileContent(e) {
        let t = this.folderName + "/" + e;
        return (await this._sendRequest("GET", t, {
            Accept: "application/octet-stream"
        })).responseText;
    }
}

class Ae extends X {
    constructor() {
        super(...arguments), i(this, "folderName", "JHS-数据备份"), i(this, "cacheItems", [ {
            key: "jhs_dmm_video",
            text: "🎥 预览视频缓存",
            title: "预览视频缓存"
        }, {
            key: "jhs_other_site",
            text: "🌍 第三方站点缓存",
            title: "第三方站点资源检测结果, 如missav,123Av等"
        }, {
            key: "jhs_screenShot",
            text: "🖼️ 缩略图缓存",
            title: "缩略图缓存"
        }, {
            key: "jhs_translate",
            text: "🆎 标题翻译",
            title: "标题翻译"
        }, {
            key: "jhs_actress_info",
            text: "👩 演员信息",
            title: "演员的年龄三围等数据信息"
        }, {
            key: "jhs_score_info",
            text: "⭐ Top250|热播 评分数据",
            title: "Top250及热播的评分数据"
        }, {
            key: "third_party_ttl_cache",
            text: "⏱️ 第三方TTL缓存",
            title: "评论、相关清单、磁力搜索、缩略图等请求缓存"
        } ]);
    }
    getName() {
        return "SettingPlugin";
    }
    async initCss() {
        const e = await storageManager.getSetting();
        let t = (null == e ? void 0 : e.containerWidth) ?? "100", n = utils.isMobile() && window.innerWidth < 1e3 ? 1 : (null == e ? void 0 : e.containerColumns) ?? 5;
        this.applyImageMode().then();
        let a = `\n            section .container{\n                max-width: 1000px !important;\n                min-width: ${t}%;\n            }\n            .movie-list, .movie-list.v{\n                grid-template-columns: repeat(${n}, minmax(0, 1fr));\n            }\n        `;
        return l && (a = `\n                .container-fluid .row{\n                    max-width: 1000px !important;\n                    min-width: ${t}%;\n                    margin: auto auto;\n                }\n                \n                .container {\n                    max-width: 1000px !important;\n                    min-width: 80%;\n                    margin: auto auto;\n                }\n                \n                .masonry {\n                    grid-template-columns: repeat(${n}, minmax(0, 1fr));\n                }\n            `),
        `\n            <style>\n                ${a}\n                .nav-btn::after {\n                    content:none !important;\n                }\n                \n                #cache-data-display pre {\n                    font-family: Consolas, Monaco, 'Andale Mono', monospace;\n                    white-space: pre-wrap;\n                    word-wrap: break-word;\n                    line-height: 1.5;\n                    color: #333;\n                    border: 1px solid #ddd;\n                }\n                \n                .cache-item {\n                    transition: all 0.2s ease;\n                }\n                .cache-item:hover {\n                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);\n                    transform: translateY(-2px);\n                }\n\n                .tooltip-icon {\n                    display: inline-block;\n                    width: 16px;\n                    height: 16px;\n                    line-height: 16px;\n                    text-align: center;\n                    border-radius: 50%;\n                    background-color: #ccc;\n                    color: white;\n                    font-size: 12px;\n                    margin-right: 5px;\n                    cursor: help;\n                }\n                .setting-item {\n                    display: flex;\n                    align-items: baseline;\n                    justify-content: space-between;\n                    margin-bottom: 3px;\n                    padding: 3px;\n                    /*border: 1px solid #ddd;\n                    border-radius: 5px;*/\n                }\n                .simple-setting .setting-item{\n                    align-items:center;\n                }\n                .setting-label {\n                    font-size: 14px;\n                    min-width: 160px;\n                    font-weight: bold;\n                    margin-right: 10px;\n                }\n                .form-content{\n                    max-width: 160px;\n                    min-width: 160px;\n                }\n                .form-content * {\n                    width: 100%;\n                    padding: 5px;\n                    margin-right: 10px;\n                    text-align: center;\n                }\n                \n                .keyword-label {\n                    display: inline-flex;\n                    align-items: center;\n                    padding: 4px 8px;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    position: relative;\n                    margin-left: 8px;\n                    margin-bottom: 5px;\n                }\n                .keyword-remove {\n                    margin-left: 6px;\n                    cursor: pointer;\n                    font-size: 12px;\n                    line-height: 1;\n                }\n                .keyword-input {\n                    padding: 6px 12px;\n                    border: 1px solid #ccc;\n                    border-radius: 4px;\n                    font-size: 14px;\n                    float:right;\n                }\n                .add-tag-btn {\n                    padding: 6px 12px;\n                    background-color: #e2e8f0;\n                    color: #334155;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 14px;\n                    margin-left: 8px;\n                    float:right;\n                }\n                .add-tag-btn:hover {\n                    background-color: #cbd5e1;\n                }\n                .tag-box {\n                    margin-top:15px;\n                }\n                \n                \n                #saveBtn,#moreBtn,#helpBtn,#clean-all {\n                    padding: 8px 20px;\n                    background-color: #4CAF50;\n                    color: white;\n                    border: none;\n                    border-radius: 4px;\n                    cursor: pointer;\n                    font-size: 16px;\n                    margin-top: 10px;\n                }\n                #saveBtn:hover {\n                    background-color: #45a049;\n                }\n                #moreBtn {\n                    background-color: #5cb85c;\n                    color: white;\n                }\n                #moreBtn:hover {\n                    background-color: #4cae4c;\n                }\n                #helpBtn {\n                    background-color: #e67e22;\n                    color: white;\n                }\n                #helpBtn:hover {\n                    background-color: #d35400;\n                }\n                .simple-setting, .mini-simple-setting {\n                    display: none;\n                    background: rgba(255,255,255,1); \n                    position: absolute;\n                    top: ${r ? "35px" : "25px"};\n                    right: ${r ? "-300%" : "0"};\n                    z-index: 1000;\n                    border: 1px solid #ddd;\n                    border-radius: 4px;\n                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);\n                    padding: 0;\n                    margin-top: 5px; /* 稍微拉开一点距离 */\n                    color: #333;\n                }\n                \n                .mini-switch {\n                  appearance: none;\n                  -webkit-appearance: none;\n                  width: 40px;\n                  height: 20px;\n                  background: #e0e0e0;\n                  border-radius: 20px;\n                  position: relative;\n                  cursor: pointer;\n                  outline: none;\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked {\n                  background: #4CAF50;\n                }\n                \n                .mini-switch::before {\n                  content: "";\n                  position: absolute;\n                  width: 16px;\n                  height: 16px;\n                  border-radius: 50%;\n                  background: white;\n                  top: 2px;\n                  left: 2px;\n                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);\n                  /*transition: all 0.2s ease;*/\n                }\n                \n                .mini-switch:checked::before {\n                  left: calc(100% - 18px);\n                }\n                \n                .side-menu-item {\n                    padding: 12px 12px;\n                    cursor: pointer;\n                    color: #333;\n                    border-left: 3px solid transparent;\n                    transition: all 0.2s;\n                    display: flex;\n                    gap: 5px;\n                }\n                \n                .side-menu-item .icon {\n                     height: 24px; \n                     width: 24px;\n                }\n                \n                .side-menu-item:hover {\n                    background-color: #e9e9e9;\n                }\n                \n                .side-menu-item.active {\n                    background-color: #e0e0e0;\n                    border-left: 3px solid #5d87c2;\n                    font-weight: bold;\n                }\n                \n                .content-panel {\n                    display: none;\n                    margin-top:20px;\n                    padding: 0 10px 10px 0;\n                    height: 100%;\n                    overflow-x: hidden;\n                    overflow-y: auto;\n                }\n                \n                .content-panel.active {\n                    display: block;\n                }\n                \n                input[type="checkbox"]:disabled {\n                    opacity: 0.6; \n                    cursor: default !important;\n                }\n            </style>\n        `;
    }
    async handle() {
        if (await storageManager.getSetting("enableClog", _) === _ && clog.show(), r) {
            let e = function() {
                $(".navbar-search").is(":hidden") ? ($(".mini-setting-box").hide(), $(".setting-box").show()) : ($(".mini-setting-box").show(),
                $(".setting-box").hide());
            };
            $("#navbar-menu-user .navbar-end").prepend('<div class="navbar-item has-dropdown is-hoverable setting-box" style="position:relative;">\n                    <a id="setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-right:15px !important;">\n                        设置\n                    </a>\n                    <div class="simple-setting"></div>\n                </div>'),
            utils.loopDetector((() => $("#miniHistoryBtn").length > 0), (() => {
                $(".miniHistoryBtnBox").before('\n                    <div class="navbar-item mini-setting-box" style="position:relative;margin-left: auto;">\n                        <a id="mini-setting-btn" class="navbar-link nav-btn" style="color: #ff8400 !important;padding-left:0 !important;padding-right:0 !important;">\n                            设置\n                        </a>\n                        <div class="mini-simple-setting"></div>\n                    </div>\n                '),
                e();
            })), $(window).resize(e);
        }
        l && (utils.loopDetector((() => $("#waitCheckBtn").length), (() => {
            $("#waitCheckBtn").parent().append('\n                    <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                        <div class="setting-box">\n                            <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                <span>设置</span>\n                            </a>\n                            <div class="simple-setting"></div>\n                        </div>\n                    </div>\n               ');
        }), 1, 1e4, !1), isDetailPage && $("h3").before('\n                    <div class="container-fluid" style="margin-top:20px">\n                        <div id="top-right-box" style="position: relative; display: flex; flex-grow: 1;justify-content: flex-end;z-index: 12345679 !important;">\n                            <div class="setting-box">\n                                <a id="setting-btn" class="menu-btn main-tab-btn" style="background-color:#6e685e !important;">\n                                    <span>设置</span>\n                                </a>\n                                <div class="simple-setting"></div>\n                            </div>\n                        </div>\n                    </div>\n               ')),
        $(".main-nav, .container-fluid").on("click", "#setting-btn, #mini-setting-btn", (() => {
            clog.lowZIndex(), this.openSettingDialog();
        })), $(".main-nav, .container-fluid").on("mouseenter", ".setting-box", (() => {
            $(".simple-setting").html(this.simpleSetting()).show(), this.initSimpleSettingForm().then(),
            clog.lowZIndex();
        })).on("mouseleave", ".setting-box", (() => {
            $(".simple-setting").html("").hide();
        })), $(".main-nav, .container-fluid").on("mouseenter", ".mini-setting-box", (() => {
            $(".mini-simple-setting").html(this.simpleSetting()).show(), this.initSimpleSettingForm().then(),
            clog.lowZIndex();
        })).on("mouseleave", ".mini-setting-box", (() => {
            $(".mini-simple-setting").html("").hide();
        }));
    }
    async openSettingDialog(e = "backup-panel", t) {
        const n = this.cacheItems.map((e => `\n            <div class="cache-item" style="border: 1px solid #eee; border-radius: 8px; padding: 12px;">\n                <div style="font-weight: bold; margin-bottom: 8px;">${e.text}</div>\n                <div style="display: flex; gap: 8px;">\n                    <a class="menu-btn clean-btn" data-key="${e.key}" style="background-color:#448cc2; flex:1; text-align:center;" title="${e.title}">\n                        <span>清理</span>\n                    </a>\n                    <a class="menu-btn view-btn" data-key="${e.key}" style="background-color:#b2bec0; flex:1; text-align:center;" >\n                        <span>查看</span>\n                    </a>\n                </div>\n            </div>\n        `)).join("");
        let a = "";
        L.forEach((e => {
            e.canSelect && (a += `<option value="${e.quality}">${e.text}</option>`);
        }));
        const i = this.getBean("CoverButtonPlugin");
        let s = `\n            <div style="display: flex; height: 100%;">\n                <div style="width: 140px; flex-shrink: 0; padding: 15px 0; background: #f5f5f5; border-right: 1px solid #ddd;">\n                    <div class="side-menu-item ${"backup-panel" === e ? "active" : ""}" data-panel="backup-panel">💾 数据备份</div>\n                    <div class="side-menu-item ${"base-panel" === e ? "active" : ""}" data-panel="base-panel">⚙️ 基础配置</div>\n                    <div class="side-menu-item ${"filter-panel" === e ? "active" : ""}" data-panel="filter-panel">🚫 屏蔽配置</div>\n                    <div class="side-menu-item ${"task-panel" === e ? "active" : ""}" data-panel="task-panel">📋 定时任务</div>\n                    <div class="side-menu-item ${"domain-panel" === e ? "active" : ""}" data-panel="domain-panel" title="第三方视频资源域名配置">🌐 外部网站</div>\n                    <div class="side-menu-item ${"hotkey-panel" === e ? "active" : ""}" data-panel="hotkey-panel">⌨️ 快捷键配置</div>\n                    <div class="side-menu-item ${"cache-panel" === e ? "active" : ""}" data-panel="cache-panel">🧹 清理缓存</div>\n                </div>\n        \n                <div style="flex: 1; display: flex; flex-direction: column; height: 100%; ">\n                    <div style="flex: 1; margin: 0 10px; padding-bottom: 20px;overflow: hidden">\n                    \n                        \x3c!-- 数据备份面板 --\x3e\n                        <div id="backup-panel" class="content-panel" style="display: ${"backup-panel" === e ? "block" : "none"};">\n                            <div style="margin-bottom: 20px">\n                                <a id="importBtn" class="menu-btn" style="background-color:#d25a88"><span>导入数据</span></a>\n                                <a id="exportBtn" class="menu-btn" style="background-color:#85d0a3"><span>导出数据</span></a>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">WebDav备份</span>\n                                <div>\n                                    <a id="webdavBackupListBtn" class="menu-btn" style="background-color:#5d87c2"><span>查看备份</span></a>\n                                    <a id="webdavBackupBtn" class="menu-btn" style="background-color:#64bb69"><span>备份数据</span></a>\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">服务地址:</span>\n                                <div class="form-content">\n                                    <input id="webDavUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">用户名:</span>\n                                <div class="form-content">\n                                    <input id="webDavUsername">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">密码:</span>\n                                <div class="form-content">\n                                    <input id="webDavPassword">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        \n                        \x3c!-- 基础设置面板 --\x3e\n                        <div id="base-panel" class="content-panel" style="display: ${"base-panel" === e ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">打开待鉴定窗口数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="waitCheckCount" min="1" max="20" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">已鉴定标签展示位置:</span>\n                                <div class="form-content">\n                                    <select id="tagPosition">\n                                        <option value="rightTop">右上</option>\n                                        <option value="leftTop">左上</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    鉴定补录演员信息 <span data-tip="在列表页进行鉴定是获取不到演员名称的, 开启后, 额外解析详情页补录演员名称, 因发请求解析费时, 会被以往慢1秒左右">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableSaveActressCarInfo" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item" style="margin-top:10px">\n                                <span class="setting-label">\n                                    封面快捷按钮\n                                </span>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.screenSvg}长缩略图:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableScreenSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.videoSvg}预览视频:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableVideoSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.handleSvg}鉴定按钮:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableHandleSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.siteSvg}第三方跳转:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableSiteSvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">\n                                    ${i.copySvg}复制按钮:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableCopySvg" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                            <div class="setting-item">\n                                <span class="setting-label">预览视频默认画质:</span>\n                                <div class="form-content">\n                                    <select id="videoQuality">\n                                        ${a}\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">评论区条数:</span>\n                                <div class="form-content">\n                                    <select id="reviewCount">\n                                        <option value="10">10条</option>\n                                        <option value="20">20条</option>\n                                        <option value="30">30条</option>\n                                        <option value="40">40条</option>\n                                        <option value="50">50条</option>\n                                    </select>\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${r ? "" : "do-hide"}">\n                                <span class="setting-label">\n                                    高亮已收藏演员 <span data-tip="详情页, 对已收藏的演员进行边框高亮提醒">❓</span>\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableFavoriteActresses" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item ${r ? "" : "do-hide"}">\n                                <span id="highlightedTagLabel" class="setting-label">\n                                    分类标签|高亮演员-边框样式:\n                                </span>\n                                <div class="form-content" style="display: flex; align-items: center;">\n                                    <input type="number" id="highlightedTagNumber" min="0" max="20">\n                                    <input type="color" id="highlightedTagColor">\n                                </div>\n                            </div>\n\n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求超时时间(毫秒):</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpTimeout" min="1000" max="10000" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">请求失败重试次数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="httpRetryCount" min="0" max="10" style="width: 100%;">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    启用控制台日志:\n                                </span>\n                                <div class="form-content">\n                                    <select id="enableClog">\n                                        <option value="no">禁用</option>\n                                        <option value="yes">开启</option>\n                                    </select>\n                                </div>\n                            </div>\n\n                            <div class="setting-item">\n                                <span class="setting-label">日志最大行数:</span>\n                                <div class="form-content">\n                                    <input type="number" id="clogMsgCount" min="100" max="3000" style="width: 100%;">\n                                </div>\n                            </div>\n                        </div>\n                        \n                        \x3c!-- 定时任务 --\x3e\n                        <div id="task-panel" class="content-panel" style="display: ${"task-panel" === e ? "block" : "none"};">\n                        \n                            <div class="setting-item">\n                                <span class="setting-label">请求并发数量:</span>\n                                <div class="form-content">\n                                    <input type="number" id="checkConcurrencyCount" min="2" max="5" style="width: 100%;">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">请求间隔时间(毫秒):</span>\n                                <div class="form-content">\n                                    <input type="number" id="checkRequestSleep" min="0" max="3000" style="width: 100%;">\n                                </div>\n                            </div>\n                        \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                        \n                            <div id="setting-blacklist" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;">\n                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动检测屏蔽黑名单演员</span>\n                                <div class="setting-item">\n                                    <span class="setting-label">\n                                        任务开关: <span data-tip="变更后, 刷新页面生效">❓</span> \n                                    </span>\n                                    <div class="form-content">\n                                        <select id="enableCheckBlacklist">\n                                            <option value="no">禁用</option>\n                                            <option value="yes">开启</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">任务间隔时间:</span>\n                                    <div class="form-content">\n                                         <select id="checkBlacklist_intervalTime">\n                                            <option value="2">每2小时</option>\n                                            <option value="3">每3小时</option>\n                                            <option value="6">每6小时</option>\n                                            <option value="12">每12小时</option>\n                                            <option value="24">每24小时</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">检测规则:</span>\n                                    <div class="form-content">\n                                         <select id="checkBlacklist_ruleTime">\n                                            <option value="0">全部检测</option>\n                                            <option value="8760">不检测停更1年以上</option>\n                                            <option value="17520">不检测停更2年以上</option>\n                                            <option value="26280">不检测停更3年以上</option>\n                                        </select>\n                                    </div>\n                                </div>\n                            </div>\n                        \n                            <div id="setting-checkFavoriteActress" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;" class="${r ? "" : "do-hide"}">\n                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动同步已收藏的演员</span>\n                                <div class="setting-item">\n                                    <span class="setting-label">\n                                        任务开关: <span data-tip="变更后, 刷新页面生效">❓</span> \n                                    </span>\n                                    <div class="form-content">\n                                        <select id="enableCheckFavoriteActress">\n                                            <option value="no">禁用</option>\n                                            <option value="yes">开启</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">任务间隔时间:</span>\n                                    <div class="form-content">\n                                         <select id="checkFavoriteActress_IntervalTime">\n                                            <option value="12">每12小时</option>\n                                            <option value="24">每24小时</option>\n                                        </select>\n                                    </div>\n                                </div>\n                            </div>\n                        \n                            <div id="setting-checkNewVideo" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;" class="${r ? "" : "do-hide"}">\n                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动检测已收藏演员的最新作品</span>\n                                <div class="setting-item">\n                                    <span class="setting-label">\n                                        任务开关: <span data-tip="变更后, 刷新页面生效">❓</span> \n                                    </span>\n                                    <div class="form-content">\n                                        <select id="enableCheckNewVideo">\n                                            <option value="no">禁用</option>\n                                            <option value="yes">开启</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">任务间隔时间:</span>\n                                    <div class="form-content">\n                                         <select id="checkNewVideo_intervalTime">\n                                            <option value="2">每2小时</option>\n                                            <option value="3">每3小时</option>\n                                            <option value="6">每6小时</option>\n                                            <option value="12">每12小时</option>\n                                            <option value="24">每24小时</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <div class="setting-item">\n                                    <span class="setting-label">检测规则:</span>\n                                    <div class="form-content">\n                                         <select id="checkNewVideo_ruleTime">\n                                            <option value="0">全部检测</option>\n                                            <option value="8760">不检测停更1年以上</option>\n                                            <option value="17520">不检测停更2年以上</option>\n                                            <option value="26280">不检测停更3年以上</option>\n                                        </select>\n                                    </div>\n                                </div>\n                            </div>\n                        </div>               \n         \n                        \x3c!-- 域名设置面板 --\x3e\n                        <div id="domain-panel" class="content-panel" style="display: ${"domain-panel" === e ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - MissAv:</span>\n                                <div class="form-content">\n                                    <input id="missAvUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - Jable:</span>\n                                <div class="form-content">\n                                    <input id="jableUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - Avgle:</span>\n                                <div class="form-content">\n                                    <input id="avgleUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - JavTrailer:</span>\n                                <div class="form-content">\n                                    <input id="javTrailersUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - 123Av:</span>\n                                <div class="form-content">\n                                    <input id="av123Url">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - JavDb:</span>\n                                <div class="form-content">\n                                    <input id="javDbUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - JavBus:</span>\n                                <div class="form-content">\n                                    <input id="javBusUrl">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">域名 - SupJav:</span>\n                                <div class="form-content">\n                                    <input id="supJavUrl">\n                                </div>\n                            </div>           \n                        </div>\n                         \n                         \x3c!-- 快捷键 --\x3e\n                        <div id="hotkey-panel" class="content-panel" style="display: ${"hotkey-panel" === e ? "block" : "none"};">\n                            <p style="color: #666; font-size: 0.9em;">修改后, 刷新页面生效</p>\n                            <div class="setting-item">\n                                <span class="setting-label">${m}:</span>\n                                <div class="form-content">\n                                    <input id="filterHotKey" placeholder="录入快捷键" data-default-hotkey="a">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${v}:</span>\n                                <div class="form-content">\n                                    <input id="favoriteHotKey" placeholder="录入快捷键" data-default-hotkey="s">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${y}:</span>\n                                <div class="form-content">\n                                    <input id="hasDownHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">${k}:</span>\n                                <div class="form-content">\n                                    <input id="hasWatchHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            <div class="setting-item">\n                                <span class="setting-label">⏩ 快进:</span>\n                                <div class="form-content">\n                                    <input id="speedVideoHotKey" placeholder="录入快捷键" data-default-hotkey="z">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">▲ 折叠:</span>\n                                <div class="form-content">\n                                    <input id="foldCategoryHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">💻 控制台:</span>\n                                <div class="form-content">\n                                    <input id="clogHotKey" placeholder="录入快捷键">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div class="setting-item">\n                                <span class="setting-label">\n                                    <span data-tip="列表页,鼠标放置图片上时可使用快捷键">❓ </span> 对视频列表页启用快捷键:\n                                </span>\n                                <div class="form-content">\n                                    <input type="checkbox" id="enableImageHotKey" class="mini-switch">\n                                </div>\n                            </div>\n\n                        </div>\n                        \n                        \x3c!-- 屏蔽设置面板 --\x3e\n                        <div id="filter-panel" class="content-panel" style="display: ${"filter-panel" === e ? "block" : "none"};">\n                            <div class="setting-item">\n                                <span class="setting-label">\n                                     启用划词屏蔽 <span data-tip="视频详情页中, 标题或评论区选中文字, 按右键可快捷加入屏蔽词">❓ </span>\n                                </span>\n                                <div style="display: flex">\n                                    <input type="checkbox" id="enableTitleSelectFilter" class="mini-switch">\n                                </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="reviewKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">评论区屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                            \n                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n                            \n                            <div id="filterKeywordContainer">\n                                <div class="setting-item">\n                                    <span class="setting-label">视频标题屏蔽词:</span>\n                                    <div style="display: flex">\n                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">\n                                        <button class="add-tag-btn">添加</button>\n                                    </div>\n                                </div>\n                                <div class="tag-box"> </div>\n                            </div>\n                        </div>\n                        <div id="cache-panel" class="content-panel" style="display: ${"cache-panel" === e ? "block" : "none"};">\n                            <h1 style="text-align:center;font-size: 20px;font-weight: bold">以下操作, 不会对核心数据造成影响</h1>\n                            <br/>               \n                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px;">\n                                ${n}\n                            </div>    \n                            <div id="cache-data-display" style="margin-top: 20px; display: none;">\n                                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 400px; overflow: auto;"></pre>\n                            </div>\n                        </div>                        \n                    </div>\n                    \n                    <div style="flex-shrink: 0; padding: 15px 20px; text-align: right; border-top: 1px solid #eee; background: white;">   \n                        <button id="saveBtn">保存设置</button>\n                        <button id="clean-all" style="display: none">♾️ 清理全部缓存</button>\n                    </div>\n                </div>\n            </div>\n        `;
        layer.open({
            type: 1,
            title: "设置",
            content: s,
            area: utils.getResponsiveArea([ "55%", "90%" ]),
            scrollbar: !1,
            success: (e, n) => {
                $(e).find(".layui-layer-content").css("position", "relative"), this.injectHealthPanel(), this.loadForm(),
                this.bindClick(), utils.setupEscClose(n), t && t();
            },
            end: () => {
                this.getBean("CoverButtonPlugin").enableSvgBtn();
            }
        });
    }
    injectHealthPanel() {
        const e = $(".side-menu-item").parent();
        e.length && !e.find('[data-panel="health-panel"]').length && e.append('<div class="side-menu-item" data-panel="health-panel">🩺 数据体检</div>');
        const t = $(".content-panel").parent();
        t.length && !$("#health-panel").length && t.append('\n            <div id="health-panel" class="content-panel" style="display:none;">\n                <div style="display:flex; gap:8px; margin-bottom:12px;">\n                    <a id="runHealthCheckBtn" class="menu-btn" style="background-color:#448cc2"><span>重新体检</span></a>\n                    <a id="repairHealthBtn" class="menu-btn" style="background-color:#64bb69"><span>备份并修复</span></a>\n                </div>\n                <div id="health-data-display" style="background:#f8f9fa; border:1px solid #ddd; border-radius:5px; padding:12px; min-height:180px;">点击重新体检查看结果</div>\n            </div>\n        ');
    }
    async renderDataHealthPanel() {
        const e = $("#health-data-display");
        if (!e.length) return;
        e.text("体检中...");
        try {
            const t = await storageManager.inspectDataHealth(), n = t.fixable.reduce(((e, t) => e + t.count), 0), a = t.readonly.reduce(((e, t) => e + t.count), 0), i = t => t.length ? t.map((e => `<li><strong>${escapeHtml(e.message)}</strong>：${e.count}</li>`)).join("") : "<li>无</li>";
            e.html(`\n                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:12px;">\n                    <div>番号记录：<strong>${t.totals.carList}</strong></div>\n                    <div>收藏演员：<strong>${t.totals.favoriteActresses}</strong></div>\n                    <div>黑名单演员：<strong>${t.totals.blacklist}</strong></div>\n                    <div>黑名单作品：<strong>${t.totals.blacklistCarList}</strong></div>\n                </div>\n                <div style="margin-bottom:8px;">体检时间：${escapeHtml(t.checkedAt)}；可修复问题 <strong>${n}</strong> 项，只读问题 <strong>${a}</strong> 项。</div>\n                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">\n                    <div><div style="font-weight:bold;margin-bottom:4px;">可安全修复</div><ul>${i(t.fixable)}</ul></div>\n                    <div><div style="font-weight:bold;margin-bottom:4px;">仅报告</div><ul>${i(t.readonly)}</ul></div>\n                </div>\n            `);
        } catch (t) {
            console.error(t), e.text("体检失败: " + t);
        }
    }
    async repairDataHealthWithBackup() {
        const e = JSON.stringify(await storageManager.exportData()), t = `health-backup-${utils.getNowStr("_", "_")}.json`;
        utils.download(e, t);
        const n = await storageManager.repairDataHealth();
        show.ok(`已修复 ${n.fixedGroups} 组数据问题，修复前备份已下载`), await this.renderDataHealthPanel();
    }
    simpleSetting() {
        return `\n             <div class="jhs-scrollbar" style="margin-top:20px;max-height:90vh; overflow-y:auto;">\n                <div style="margin: 0 10px;">\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            显示已鉴定内容:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽单番号: </span><input type="checkbox" id="showFilterItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽演员: </span><input type="checkbox" id="showFilterActorItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽关键词: </span><input type="checkbox" id="showFilterKeywordItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">收藏: </span><input type="checkbox" id="showFavoriteItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已下载: </span><input type="checkbox" id="showHasDownItem" class="mini-switch"><br/>\n                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已观看: </span><input type="checkbox" id="showHasWatchItem" class="mini-switch"><br/>\n                        </div>\n                    </div>\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="快速显示所有已鉴定内容,减少对以上开关的频繁操作">❓ </span> 显示所有:\n                        </span>\n                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">\n                            <input type="checkbox" id="showAllItem" class="mini-switch">\n                        </div>\n                    </div>\n                    \n\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">鉴定后立即关闭页面:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="needClosePage" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                             <span data-tip="使用瀑布流模式, 排序方式将调整为默认">❓ </span>瀑布流模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="autoPage" class="mini-switch">\n                        </div>\n                    </div>\n       \n                    <div class="setting-item">\n                        <span class="setting-label">启用标题翻译:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="translateTitle" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">启用悬浮大图:</span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="hoverBigImg" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                                        \n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    ${r ? '\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页是否展示女优年龄、三围等信息">❓ </span>加载女优信息:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadActressInfo" class="mini-switch">\n                        </div>\n                    </div>' : ""}\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页显示外部网站入口；点击检测外部站点后才请求第三方站点">❓ </span>显示外部网站:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadOtherSite" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页图片区首列位置加载长缩略图">❓ </span>加载长缩略图:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadScreenShot" class="mini-switch">\n                        </div>\n                    </div>\n                    \n                     <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="详情页解析更多更高画质的预览视频">❓ </span>更高画质预览视频:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableLoadPreviewVideo" class="mini-switch">\n                        </div>\n                    </div>\n\n                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>\n\n                    <div class="setting-item">\n                        <span class="setting-label">\n                            <span data-tip="列数6以上,建议开启竖图">❓ </span>竖图模式:\n                        </span>\n                        <div class="form-content" style="text-align: right;">\n                            <input type="checkbox" id="enableVerticalModel" class="mini-switch">\n                        </div>\n                    </div>\n                                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面列数: <span id="showContainerColumns"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerColumns" min="2" max="10" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                    \n                    <div class="setting-item">\n                        <span class="setting-label">页面宽度: <span id="showContainerWidth"></span></span>\n                        <div class="form-content">\n                            <input type="range" id="containerWidth" min="0" max="30" step="1" style="padding:5px 0">\n                        </div>\n                    </div>\n                </div>\n                <div style="padding: 0 20px 15px; text-align: right; border-top: 1px solid #eee;">   \n                    <button id="helpBtn" style="float:left;">常见问题</button>\n                    <button id="moreBtn">更多设置</button>\n                </div>\n            </div>\n        `;
    }
    async loadForm() {
        let e = await storageManager.getSetting();
        $("#videoQuality").val(e.videoQuality), $("#reviewCount").val(e.reviewCount || 20),
        $("#tagPosition").val(e.tagPosition || "rightTop"), $("#waitCheckCount").val(e.waitCheckCount || 5),
        $("#checkConcurrencyCount").val(e.checkConcurrencyCount || 2), $("#checkRequestSleep").val(e.checkRequestSleep || 100),
        $("#enableCheckBlacklist").val(e.enableCheckBlacklist || _), $("#checkBlacklist_intervalTime").val(e.checkBlacklist_intervalTime || 12),
        $("#checkBlacklist_ruleTime").val(e.checkBlacklist_ruleTime || 8760), $("#enableCheckFavoriteActress").val(e.enableCheckFavoriteActress || _),
        $("#checkFavoriteActress_IntervalTime").val(e.checkFavoriteActress_IntervalTime || 24),
        $("#enableCheckNewVideo").val(e.enableCheckNewVideo || _), $("#checkNewVideo_intervalTime").val(e.checkNewVideo_intervalTime || 12),
        $("#checkNewVideo_ruleTime").val(e.checkNewVideo_ruleTime || 8760);
        const t = e.highlightedTagNumber || 1, n = e.highlightedTagColor || "#ce2222";
        $("#highlightedTagNumber").val(e.highlightedTagNumber || 1), $("#highlightedTagColor").val(e.highlightedTagColor || "#ce2222"),
        $("#highlightedTagLabel").css("border", `${t}px solid ${n}`), $("#enableClog").val(e.enableClog || _),
        $("#clogMsgCount").val(e.clogMsgCount || 2e3),
        $("#httpTimeout").val(e.httpTimeout || 5e3), $("#httpRetryCount").val(e.httpRetryCount || 3),
        $("#webDavUrl").val(e.webDavUrl || ""), $("#webDavUsername").val(e.webDavUsername || ""),
        $("#webDavPassword").val(await decryptCredential(e.webDavPassword) || ""), $("#enableTitleSelectFilter").prop("checked", !e.enableTitleSelectFilter || e.enableTitleSelectFilter === _),
        $("#enableFavoriteActresses").prop("checked", !e.enableFavoriteActresses || e.enableFavoriteActresses === _),
        $("#enableSaveActressCarInfo").prop("checked", !!e.enableSaveActressCarInfo && e.enableSaveActressCarInfo === _),
        $("#enableScreenSvg").prop("checked", !e.enableScreenSvg || e.enableScreenSvg === _),
        $("#enableVideoSvg").prop("checked", !e.enableVideoSvg || e.enableVideoSvg === _),
        $("#enableHandleSvg").prop("checked", !e.enableHandleSvg || e.enableHandleSvg === _),
        $("#enableSiteSvg").prop("checked", !e.enableSiteSvg || e.enableSiteSvg === _),
        $("#enableCopySvg").prop("checked", !e.enableCopySvg || e.enableCopySvg === _);
        const a = this.getBean("OtherSitePlugin"), i = await a.getMissAvUrl(), s = await a.getjableUrl(), o = await a.getAvgleUrl(), r = await a.getJavTrailersUrl(), l = await a.getAv123Url(), c = await a.getJavDbUrl(), d = await a.getJavBusUrl(), h = await a.getSupJavUrl();
        $("#missAvUrl").val(i), $("#jableUrl").val(s), $("#avgleUrl").val(o), $("#javTrailersUrl").val(r),
        $("#av123Url").val(l), $("#javDbUrl").val(c), $("#javBusUrl").val(d), $("#supJavUrl").val(h);
        let g = await storageManager.getReviewFilterKeywordList(), p = await storageManager.getTitleFilterKeyword();
        g && g.forEach((e => {
            this.addLabelTag("#reviewKeywordContainer", e);
        })), p && p.forEach((e => {
            this.addLabelTag("#filterKeywordContainer", e);
        })), [ "#reviewKeywordContainer", "#filterKeywordContainer" ].forEach((e => {
            $(`${e} .add-tag-btn`).on("click", (t => this.addKeyword(t, e))), $(`${e} .keyword-input`).on("keypress", (t => {
                "Enter" === t.key && this.addKeyword(t, e);
            }));
        })), $("#hotkey-panel [id]").map(((e, t) => t.id)).get().forEach((t => {
            const n = $(`#${t}`), a = void 0 !== e[t] ? e[t] : n.attr("data-default-hotkey") || "";
            n.val(a).on("input", (e => {
                let t = $(e.target).val();
                (/[\u4e00-\u9fa5]/.test(t) || /^Shift[a-zA-Z0-9]+$/.test(t)) && ($(e.target).val(""),
                show.error("非法输入：不能输入中文或输入法转换错误"));
            })).on("keydown", (e => this.handleHotkeyInput(e, n)));
        })), $("#enableImageHotKey").prop("checked", !!e.enableImageHotKey && e.enableImageHotKey === _);
    }
    handleHotkeyInput(e, t) {
        e.preventDefault();
        const n = this.parseHotkey(e);
        "" !== n ? this.isDuplicateHotkey(n, t.attr("id")) ? show.error("该快捷键已被其他功能使用！") : t.val(n) : t.val("");
    }
    parseHotkey(e) {
        if ("Backspace" === e.key || "Process" === e.key) return "";
        const t = [];
        e.ctrlKey && t.push("Ctrl"), e.shiftKey && t.push("Shift"), e.altKey && t.push("Alt"),
        e.metaKey && t.push("Cmd");
        const n = {
            " ": "Space",
            Control: "Ctrl",
            Meta: "Cmd",
            ArrowUp: "Up",
            ArrowDown: "Down",
            ArrowLeft: "Left",
            ArrowRight: "Right"
        }[e.key] || (e.key.length > 1 ? e.key.replace("Arrow", "") : e.key);
        return [ "Control", "Shift", "Alt", "Meta" ].includes(e.key) || t.push(n), t.length > 0 ? t.join("+") : "";
    }
    isDuplicateHotkey(e, t) {
        let n = !1;
        return $("#hotkey-panel [id]").each(((a, i) => {
            if (i.id !== t && e && e === $(i).val()) return n = !0, !1;
        })), n;
    }
    async initSimpleSettingForm() {
        let e = await storageManager.getSetting();
        $("#containerColumns").val(e.containerColumns || 5), $("#showContainerColumns").text(e.containerColumns || 5),
        $("#containerWidth").val((e.containerWidth || 100) - 70), $("#showContainerWidth").text((e.containerWidth || 100) + "%"),
        $("#needClosePage").prop("checked", !e.needClosePage || e.needClosePage === _),
        $("#autoPage").prop("checked", !e.autoPage || e.autoPage === _), $("#translateTitle").prop("checked", !e.translateTitle || e.translateTitle === _),
        $("#enableLoadActressInfo").prop("checked", !e.enableLoadActressInfo || e.enableLoadActressInfo === _),
        $("#enableLoadOtherSite").prop("checked", !e.enableLoadOtherSite || e.enableLoadOtherSite === _),
        $("#containerColumns").on("input", (async e => {
            let t = $("#containerColumns").val();
            if ($("#showContainerColumns").text(t), r) {
                document.querySelector(".movie-list").style.gridTemplateColumns = `repeat(${t}, minmax(0, 1fr))`;
            }
            if (l) {
                document.querySelector(".masonry").style.gridTemplateColumns = `repeat(${t}, minmax(0, 1fr))`;
            }
            await storageManager.saveSettingItem("containerColumns", t), this.applyImageMode();
        })), $("#containerWidth").on("input", (async e => {
            let t = parseInt($(e.target).val());
            const n = t + 70 + "%";
            if ($("#showContainerWidth").text(n), r) {
                document.querySelector("section .container").style.minWidth = n;
            }
            if (l) {
                document.querySelector(".container-fluid .row").style.minWidth = n;
            }
            storageManager.saveSettingItem("containerWidth", t + 70);
        })), $("#showFilterItem").prop("checked", !!e.showFilterItem && e.showFilterItem === _),
        $("#showFilterActorItem").prop("checked", !!e.showFilterActorItem && e.showFilterActorItem === _),
        $("#showFilterKeywordItem").prop("checked", !!e.showFilterKeywordItem && e.showFilterKeywordItem === _),
        $("#showFavoriteItem").prop("checked", !e.showFavoriteItem || e.showFavoriteItem === _),
        $("#showHasDownItem").prop("checked", !e.showHasDownItem || e.showHasDownItem === _),
        $("#showHasWatchItem").prop("checked", !e.showHasWatchItem || e.showHasWatchItem === _),
        $("#showFilterItem").on("change", (async e => {
            let t = $("#showFilterItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterItem", t), window.refresh();
        })), $("#showFilterActorItem").on("change", (async e => {
            let t = $("#showFilterActorItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterActorItem", t), window.refresh();
        })), $("#showFilterKeywordItem").on("change", (async e => {
            let t = $("#showFilterKeywordItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFilterKeywordItem", t), window.refresh();
        })), $("#showFavoriteItem").on("change", (async e => {
            let t = $("#showFavoriteItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showFavoriteItem", t), window.refresh();
        })), $("#showHasDownItem").on("change", (async e => {
            let t = $("#showHasDownItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showHasDownItem", t), window.refresh();
        })), $("#showHasWatchItem").on("change", (async e => {
            let t = $("#showHasWatchItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showHasWatchItem", t), window.refresh();
        }));
        const t = $("#showFilterItem, #showFilterActorItem, #showFilterKeywordItem, #showFavoriteItem, #showHasDownItem, #showHasWatchItem"), n = () => {
            const e = $("#showAllItem").is(":checked");
            t.prop("disabled", e), e ? t.attr("data-tip", "请先关闭显示所有才可点击") : t.removeAttr("data-tip");
        };
        $("#showAllItem").prop("checked", !!e.showAllItem && e.showAllItem === _), $("#showAllItem").on("change", (async e => {
            let t = $("#showAllItem").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("showAllItem", t), n(), window.refresh();
        })), n(), $("#needClosePage").on("change", (async e => {
            await storageManager.saveSettingItem("needClosePage", $("#needClosePage").is(":checked") ? _ : C),
            window.refresh();
        })), $("#autoPage").on("change", (async e => {
            const t = $("#autoPage").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("autoPage", t), t === _ ? $("#sort-toggle-btn").hide() : $("#sort-toggle-btn").show();
        })), $("#translateTitle").on("change", (async e => {
            const t = $("#translateTitle").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("translateTitle", t), t === _ ? (await this.getBean("ListPagePlugin").doFilter(),
            isDetailPage && await this.getBean("TranslatePlugin").translate()) : (await this.getBean("ListPagePlugin").revertTranslation(),
            $(".translated-title").remove());
        })), $("#hoverBigImg").prop("checked", !!e.hoverBigImg && e.hoverBigImg === _),
        $("#hoverBigImg").on("change", (async e => {
            const t = $("#hoverBigImg").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("hoverBigImg", t), t === _ ? window.imageHoverPreviewObj = new ImageHoverPreview({
                selector: this.getSelector().coverImgSelector
            }) : window.imageHoverPreviewObj && window.imageHoverPreviewObj.destroy();
        })), $("#enableLoadActressInfo").on("change", (async e => {
            const t = $("#enableLoadActressInfo").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadActressInfo", t), t === _ ? this.getBean("ActressInfoPlugin").loadActressInfo() : $(".actress-info").remove();
        })), $("#enableLoadOtherSite").on("change", (async e => {
            const t = $("#enableLoadOtherSite").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadOtherSite", t), t === _ ? this.getBean("OtherSitePlugin").loadOtherSite().then() : $("#otherSiteBox").remove();
        })), $("#enableLoadScreenShot").prop("checked", !e.enableLoadScreenShot || e.enableLoadScreenShot === _),
        $("#enableLoadScreenShot").on("change", (async e => {
            const t = $("#enableLoadScreenShot").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadScreenShot", t), t === _ ? this.getBean("ScreenShotPlugin").loadScreenShot().then() : $(".screen-container").remove();
        })), $("#enableLoadPreviewVideo").prop("checked", !e.enableLoadPreviewVideo || e.enableLoadPreviewVideo === _),
        $("#enableLoadPreviewVideo").on("change", (async e => {
            const t = $("#enableLoadPreviewVideo").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableLoadPreviewVideo", t);
        })), $("#enableVerticalModel").prop("checked", !!e.enableVerticalModel && e.enableVerticalModel === _),
        $("#enableVerticalModel").on("change", (async e => {
            const t = $("#enableVerticalModel").is(":checked") ? _ : C;
            await storageManager.saveSettingItem("enableVerticalModel", t), this.applyImageMode();
        })), $("#moreBtn").on("click", (() => {
            $(".simple-setting").html("").hide(), this.openSettingDialog("base-panel");
        })), $("#helpBtn").on("click", (() => {
            layer.open({
                type: 1,
                title: "",
                shadeClose: !0,
                scrollbar: !1,
                content: '\n<style>\n    .help-container {\n        font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif;\n        color: #333;\n        padding: 15px;\n        max-height: 100%;\n        overflow-y: auto;\n    }\n    \n    .help-section {\n        margin-bottom: 25px;\n    }\n    \n    .help-section summary {\n        font-size: 18px;\n        color: #3498db;\n        margin-bottom: 12px;\n        cursor: pointer;\n    }\n    \n    .help-content {\n        background-color: #f9f9f9;\n        border-radius: 5px;\n        padding: 15px;\n        border-left: 4px solid #3498db;\n    }\n    \n    .help-content p {\n        line-height: 1.6;\n        margin-bottom: 10px;\n    }\n    .help-section img {\n        max-width: 100%;\n        height: auto;\n        border: 1px solid #ddd;\n        border-radius: 4px;\n        box-shadow: 0 2px 4px rgba(0,0,0,0.1);\n    }\n\n</style>\n\n<div class="help-container">\n    <h1 style="font-size: 22px; margin-bottom: 20px; color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">使用说明</h1>\n    \n    <details class="help-section">\n        <summary>1. 无法查看预览视频，提示分流?</summary>\n        <div class="help-content">\n            <p>JavDB限制日本IP的访问，而预览视频来自DMM，需要日本IP才能访问。</p>\n            <p>这样会导致二者无法同时使用，需要对其一进行代理转发。</p>\n            <p>将 cc3001.dmm.co.jp 及 dmm.co 分流到日本ip。</p>\n            <p><a href="https://youtu.be/wQUK8z_YeU4?t=121" target="_blank">Clash Verge分流规则设置 </a> (如果你是别的代理软件，自行搜索如何分流)</p>\n        </div>\n    </details>\n    \n    <details class="help-section">\n        <summary>2. 如何屏蔽某一系列的番号?</summary>\n        <div class="help-content">\n            <p>方法一：设置中-添加视频标题关键词，如: VENX-</p>\n            <p>方法二：进入详情页，选中标题文字，右键可加入</p>\n            <img src="https://i.imgur.com/lVnhK5A.png" alt="进入详情页，选中标题，进行右键"/>\n        </div>\n    </details>\n\n    <details class="help-section">\n        <summary>3. 屏蔽某演员，如何只屏蔽单体影片?</summary>\n        <div class="help-content">\n            <p>屏蔽演员前，先筛选分类，再点屏蔽</p>\n            <img src="https://imgur.com/Ue7eCAi.png" alt="屏蔽演员前，先筛选分类，再点屏蔽"/>\n        </div>\n    </details>\n    \n    \n</div>\n',
                area: utils.getResponsiveArea([ "50%", "90%" ])
            });
        }));
    }
    async applyImageMode() {
        $("#verticalImgStyle").remove();
        if (await storageManager.getSetting("enableVerticalModel", C) === _) {
            let e = "100% 50% !important";
            window.location.href.includes("/advanced_search?type=100") && (e = "50% 50% !important");
            const t = `\n                .cover {\n                    min-height: 350px !important;\n                    overflow: hidden !important;\n                    padding-top: 142% !important;\n                }\n                \n                .cover img {\n                    object-fit: cover !important;\n                    object-position: ${e};\n                }\n                \n                /* bus的 */\n                .masonry .movie-box img {\n                    min-height: 500px !important;\n                    object-fit: cover !important;\n                    object-position: top right;\n                }\n            `;
            $("<style>").attr("id", "verticalImgStyle").text(t).appendTo("head");
        } else {
            const e = "\n                .cover {\n                    min-height:auto !important;\n                    padding-top: 67% !important;\n                }\n                .cover img {\n                    object-fit: contain !important;\n                    object-position: 50% 50% !important\n                }\n                \n                /* bus的 */\n                 .masonry .movie-box img {\n                    min-height:auto !important;\n                    object-fit: contain !important;\n                    object-position: top;\n                }\n            ";
            $("<style>").attr("id", "verticalImgStyle").text(e).appendTo("head");
        }
        l && this.getBean("BusImgPlugin").logImageHeightsByRow();
    }
    bindClick() {
        const settingPlugin = this;
        $(".side-menu-item").on("click", (function() {
            $(".side-menu-item").removeClass("active"), $(this).addClass("active"), $(".content-panel").hide();
            const e = $(this).data("panel");
            $("#" + e).show(), "cache-panel" === e ? ($("#saveBtn").hide(), $("#clean-all").show()) : ($("#saveBtn").show(),
            $("#clean-all").hide()), "health-panel" === e && ($("#saveBtn").hide(), $("#clean-all").hide(), settingPlugin.renderDataHealthPanel());
        })), $("#importBtn").on("click", (e => this.importData(e))), $("#exportBtn").on("click", (e => this.exportData(e))),
        $("#webdavBackupBtn").on("click", (e => this.backupDataByWebDav(e))), $("#webdavBackupListBtn").on("click", (e => this.backupListBtnByWebDav(e))),
        $("#saveBtn").on("click", (() => this.saveForm())), $("#runHealthCheckBtn").on("click", (() => this.renderDataHealthPanel())),
        $("#repairHealthBtn").on("click", (e => {
            utils.q(e, "修复前会自动下载备份，是否继续?", (() => this.repairDataHealthWithBackup()));
        })), $(".clean-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key"), n = this.cacheItems.find((e => e.key === t));
            t === storageManager.third_party_cache_key ? await storageManager.clearThirdPartyCache() : localStorage.removeItem(t),
            show.ok(`${n.text} 清理成功`), $("#cache-data-display").hide(),
            "jhs_dmm_video" === t && localStorage.removeItem("jhs_other_site_dmm");
        })), $("#clean-all").on("click", (async () => {
            this.cacheItems.forEach((e => localStorage.removeItem(e.key))), show.ok("全部缓存已清理"),
            $("#cache-data-display").hide(), localStorage.removeItem("jhs_other_site_dmm"), await storageManager.clearThirdPartyCache();
        })), $(".view-btn").on("click", (async e => {
            const t = $(e.currentTarget).data("key"), n = t === storageManager.third_party_cache_key ? JSON.stringify(await storageManager.getThirdPartyCache()) : localStorage.getItem(t), a = $("#cache-data-display"), i = a.find("pre");
            if (a.show(), n) try {
                const e = JSON.parse(n);
                i.text(JSON.stringify(e, null, 2));
            } catch {
                i.text(n);
            } else i.text("无数据");
        }));
        const e = $("#highlightedTagNumber"), t = $("#highlightedTagColor"), n = $("#highlightedTagLabel");
        function a() {
            const a = e.val(), i = t.val();
            n.css("border", `${a}px solid ${i}`);
        }
        e.on("input", a), t.on("input", a);
    }
    async saveForm() {
        let e = await storageManager.getSetting();
        e.videoQuality = $("#videoQuality").val(), e.reviewCount = $("#reviewCount").val(),
        e.tagPosition = $("#tagPosition").val(), e.waitCheckCount = $("#waitCheckCount").val(), e.highlightedTagNumber = $("#highlightedTagNumber").val(),
        e.highlightedTagColor = $("#highlightedTagColor").val(), e.checkConcurrencyCount = $("#checkConcurrencyCount").val(),
        e.checkRequestSleep = $("#checkRequestSleep").val(), e.enableCheckBlacklist = $("#enableCheckBlacklist").val(),
        e.checkBlacklist_intervalTime = $("#checkBlacklist_intervalTime").val(), e.checkBlacklist_ruleTime = $("#checkBlacklist_ruleTime").val(),
        e.enableCheckFavoriteActress = $("#enableCheckFavoriteActress").val(), e.checkFavoriteActress_IntervalTime = $("#checkFavoriteActress_IntervalTime").val(),
        e.enableCheckNewVideo = $("#enableCheckNewVideo").val(), e.checkNewVideo_intervalTime = $("#checkNewVideo_intervalTime").val(),
        e.checkNewVideo_ruleTime = $("#checkNewVideo_ruleTime").val(), e.httpTimeout = $("#httpTimeout").val(),
        e.httpRetryCount = $("#httpRetryCount").val(), e.enableClog = $("#enableClog").val(),
        e.enableClog === _ ? clog.show() : clog.hide(), e.clogMsgCount = $("#clogMsgCount").val(),
        e.webDavUrl = $("#webDavUrl").val(), e.webDavUsername = $("#webDavUsername").val(),
        e.webDavPassword = await encryptCredential($("#webDavPassword").val()), e.missAvUrl = $("#missAvUrl").val().replace(/\/$/, ""),
        e.jableUrl = $("#jableUrl").val().replace(/\/$/, ""), e.avgleUrl = $("#avgleUrl").val().replace(/\/$/, ""),
        e.javTrailersUrl = $("#javTrailersUrl").val().replace(/\/$/, ""), e.av123Url = $("#av123Url").val().replace(/\/$/, ""),
        e.javDbUrl = $("#javDbUrl").val().replace(/\/$/, ""), e.javBusUrl = $("#javBusUrl").val().replace(/\/$/, ""),
        e.supJavUrl = $("#supJavUrl").val().replace(/\/$/, ""), e.enableTitleSelectFilter = $("#enableTitleSelectFilter").is(":checked") ? _ : C,
        e.enableFavoriteActresses = $("#enableFavoriteActresses").is(":checked") ? _ : C,
        e.enableSaveActressCarInfo = $("#enableSaveActressCarInfo").is(":checked") ? _ : C,
        e.enableScreenSvg = $("#enableScreenSvg").is(":checked") ? _ : C, e.enableVideoSvg = $("#enableVideoSvg").is(":checked") ? _ : C,
        e.enableHandleSvg = $("#enableHandleSvg").is(":checked") ? _ : C, e.enableSiteSvg = $("#enableSiteSvg").is(":checked") ? _ : C,
        e.enableCopySvg = $("#enableCopySvg").is(":checked") ? _ : C, $("#hotkey-panel [id]").map(((e, t) => t.id)).get().forEach((t => {
            e[t] = $(`#${t}`).val();
        })), e.enableImageHotKey = $("#enableImageHotKey").is(":checked") ? _ : C, await storageManager.saveSetting(e);
        let t = [];
        $("#reviewKeywordContainer .keyword-label").toArray().forEach((e => {
            let n = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
            t.push(n);
        })), await storageManager.saveReviewFilterKeyword(t);
        let n = [];
        $("#filterKeywordContainer .keyword-label").toArray().forEach((e => {
            let t = $(e).text().replace("×", "").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
            n.push(t);
        })), await storageManager.saveTitleFilterKeyword(n), show.ok("保存成功"), window.refresh();
        const a = this.getBean("NewVideoPlugin");
        a && a.resetBtnTip(), this.getBean("BlacklistPlugin").resetBtnTip(), this.getBean("BlacklistPlugin").reloadTable();
    }
    addLabelTag(e, t) {
        const n = $(`${e} .tag-box`);
        let a, i = "#cbd5e1", s = "#333";
        /^[a-z]{2,}-/i.test(t) && r ? (s = "#3477ad", a = $(`\n                <a class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}" href="/video_codes/${t.replace("-", "")}" target="_blank">\n                    ${t}\n                    <span class="keyword-remove">×</span>\n                </a>\n            `)) : a = $(`\n                <div class="keyword-label" data-keyword="${t}" style="background-color: ${i}; color: ${s}">\n                    ${t}\n                    <span class="keyword-remove">×</span>\n                </div>\n            `),
        a.find(".keyword-remove").click((e => {
            e.stopPropagation(), e.preventDefault();
            const t = $(e.currentTarget);
            const n = t.closest(".keyword-label").attr("data-keyword").split(" ")[0];
            utils.q(e, `是否移除屏蔽词  ${n}?`, (async () => {
                t.parent().remove();
            }));
        })), n.append(a);
    }
    addKeyword(e, t) {
        let n = $(`${t} .keyword-input`);
        const a = n.val().trim();
        a && (this.addLabelTag(t, a), n.val(""));
    }
    importData() {
        try {
            const e = document.createElement("input");
            e.type = "file", e.accept = ".json", e.onchange = e => {
                const t = e.target.files[0];
                if (!t) return;
                const n = new FileReader;
                n.onload = e => {
                    try {
                        const t = e.target.result.toString(), n = JSON.parse(t);
                        layer.confirm("确定是否要覆盖导入？", {
                            icon: 3,
                            title: "确认覆盖",
                            btn: [ "确定", "取消" ]
                        }, (async function(e) {
                            await storageManager.importData(n), show.ok("数据导入成功"), layer.close(e), location.reload();
                        }));
                    } catch (t) {
                        console.error(t), show.error("导入失败：文件内容不是有效的JSON格式 " + t);
                    }
                }, n.onerror = () => {
                    show.error("读取文件时出错");
                }, n.readAsText(t);
            }, document.body.appendChild(e), e.click(), setTimeout((() => document.body.removeChild(e)), 1e3);
        } catch (e) {
            console.error(e), show.error("导入数据时出错: " + e.message);
        }
    }
    async backupDataByWebDav(e) {
        const t = await storageManager.getSetting(), n = t.webDavUrl;
        if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
        const a = t.webDavUsername;
        if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
        const i = await decryptCredential(t.webDavPassword);
        if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
        let s = utils.getNowStr("_", "_") + ".json", o = JSON.stringify(await storageManager.exportData());
        o = await encryptData(o);
        let r = loading();
        try {
            const e = new De(n, a, i);
            await e.backup(this.folderName, s, o), show.ok("备份完成");
        } catch (l) {
            console.error(l), show.error(l.toString());
        } finally {
            r.close();
        }
    }
    async backupListBtnByWebDav(e) {
        const t = await storageManager.getSetting(), n = t.webDavUrl;
        if (!n) return void show.error("请填写webDav服务地址并保存后, 再试此功能");
        const a = t.webDavUsername;
        if (!a) return void show.error("请填写webDav用户名并保存后, 再试此功能");
        const i = await decryptCredential(t.webDavPassword);
        if (!i) return void show.error("请填写webDav密码并保存后, 再试此功能");
        let s = loading();
        try {
            const e = new De(n, a, i), t = await e.getBackupList(this.folderName);
            this.openFileListDialog(t, e, "WebDav");
        } catch (o) {
            console.error(o), show.error(`发生错误: ${o ? o.message : o}`);
        } finally {
            s.close();
        }
    }
    openFileListDialog(e, t, n) {
        layer.open({
            type: 1,
            title: n + "备份文件",
            content: '\n                <div style="height: 100%;overflow:hidden;"> \n                    <div id="table-container" style="margin:auto auto !important;"></div>\n                </div>\n            ',
            area: [ "800px", "70%" ],
            anim: -1,
            success: a => {
                const i = new Tabulator("#table-container", {
                    layout: "fitColumns",
                    placeholder: "暂无数据",
                    virtualDom: !0,
                    data: e,
                    responsiveLayout: "collapse",
                    responsiveLayoutCollapse: !0,
                    columnDefaults: {
                        headerHozAlign: "center",
                        hozAlign: "center"
                    },
                    columns: [ {
                        title: "文件名",
                        field: "name",
                        width: 200,
                        headerSort: !1,
                        responsive: 0
                    }, {
                        title: "文件大小",
                        field: "size",
                        responsive: 1,
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = [ "B", "KB", "MB", "GB", "TB", "PB" ];
                            let i = 0, s = e.getData().size;
                            for (;s >= 1024 && i < a.length - 1; ) s /= 1024, i++;
                            return `${s % 1 == 0 ? s.toFixed(0) : s.toFixed(2)} ${a[i]}`;
                        }
                    }, {
                        title: "备份日期",
                        field: "createTime",
                        responsive: 2,
                        headerSort: !1,
                        formatter: (e, t, n) => {
                            const a = e.getData();
                            return `${utils.getNowStr("-", ":", a.createTime)}`;
                        }
                    }, {
                        title: "操作",
                        minWidth: 250,
                        responsive: 0,
                        headerSort: !1,
                        formatter: (e, a, s) => {
                            const o = e.getData();
                            return s((() => {
                                const a = e.getElement().querySelector(".a-danger"), s = e.getElement().querySelector(".a-primary"), r = e.getElement().querySelector(".a-success");
                                a && a.addEventListener("click", (e => {
                                    layer.confirm(`是否删除 ${o.name} ?`, {
                                        icon: 3,
                                        title: "提示",
                                        btn: [ "确定", "取消" ]
                                    }, (async e => {
                                        layer.close(e);
                                        let a = loading();
                                        try {
                                            await t.deleteFile(o.fileId);
                                            let e = await t.getBackupList(this.folderName);
                                            i.replaceData(e), layer.alert("删除成功");
                                        } catch (s) {
                                            console.error(s), show.error(`发生错误: ${s ? s.message : s}`);
                                        } finally {
                                            a.close();
                                        }
                                    }));
                                })), s && s.addEventListener("click", (async e => {
                                    let a = loading();
                                    try {
                                        const e = await decryptData(await t.getFileContent(o.fileId));
                                            utils.download(e, o.name);
                                    } catch (i) {
                                        clog.error(i), show.error("下载失败: " + i);
                                    } finally {
                                        a.close();
                                    }
                                })), r && r.addEventListener("click", (async e => {
                                    layer.confirm(`是否将该云备份数据 ${o.name} 导入?`, {
                                        icon: 3,
                                        title: "提示",
                                        btn: [ "确定", "取消" ]
                                    }, (async e => {
                                        layer.close(e);
                                        let a = loading();
                                        try {
                                            let e = await t.getFileContent(o.fileId);
                                            show.info("解密文件内容..."), e = await decryptData(e), show.info("解密完成, 开始导入...");
                                            const a = JSON.parse(e);
                                            await storageManager.importData(a), show.ok("导入成功!"), window.location.reload();
                                        } catch (i) {
                                            console.error(i), show.error(i);
                                        } finally {
                                            a.close();
                                        }
                                    }));
                                }));
                            })), '\n                                    <a class="a-danger">删除</a>\n                                    <a class="a-primary">下载</a>\n                                    <a class="a-success">导入</a>\n                                ';
                        }
                    } ],
                    locale: "zh-cn",
                    langs: {
                        "zh-cn": {
                            pagination: {
                                first: "首页",
                                first_title: "首页",
                                last: "尾页",
                                last_title: "尾页",
                                prev: "上一页",
                                prev_title: "上一页",
                                next: "下一页",
                                next_title: "下一页",
                                all: "所有",
                                page_size: "每页行数"
                            }
                        }
                    }
                });
            }
        });
    }
    async exportData(e) {
        try {
            const e = JSON.stringify(await storageManager.exportData()), t = `${utils.getNowStr("_", "_")}.json`;
            utils.download(e, t), show.ok("数据导出成功");
        } catch (t) {
            console.error(t), show.error("导出数据时出错: " + t.message);
        }
    }
}
