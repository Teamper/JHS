/**
 * Build the plugin categories configuration shared between inject and render.
 * Returns { categories, corePlugins }.
 */
function getPluginCategories() {
    return {
        categories: {
            status: { label: "状态管理", plugins: ["DetailPagePlugin","ListPagePlugin","NavBarPlugin","BusNavBarPlugin","BusDetailPagePlugin","DetailPageButtonPlugin","ListPageButtonPlugin","HighlightMagnetPlugin","FoldCategoryPlugin","AutoPagePlugin","HistoryPlugin","WantAndWatchedVideosPlugin"] },
            blacklist: { label: "屏蔽过滤", plugins: ["BlacklistPlugin","FilterTitleKeywordPlugin"] },
            favorite: { label: "收藏", plugins: ["FavoriteActressesPlugin"] },
            "new-video": { label: "新作品", plugins: ["NewVideoPlugin","TaskPlugin"] },
            "external-search": { label: "外部搜索", plugins: ["OtherSitePlugin","Fc2Plugin","Fc2By123AvPlugin","HitShowPlugin","TOP250Plugin","ReviewPlugin","RelatedPlugin","MagnetHubPlugin","JavTrailersPlugin"] },
            "image-viewer": { label: "图片预览", plugins: ["CoverButtonPlugin","PreviewVideoPlugin","BusPreviewVideoPlugin","ScreenShotPlugin","BusImgPlugin"] },
            avatar: { label: "演员信息", plugins: ["ActressInfoPlugin","SearchByImagePlugin"] },
            translate: { label: "翻译", plugins: ["TranslatePlugin"] },
            subtitle: { label: "字幕", plugins: ["SubTitleCatPlugin"] },
            backup: { label: "备份设置", plugins: ["SettingPlugin","LocalPlugin"] },
            "one-two-three": { label: "云盘", plugins: ["OneTwoThreeOfflinePlugin"] },
            stats: { label: "统计", plugins: ["StatsPlugin"] }
        },
        corePlugins: ["SettingPlugin","StatsPlugin"]
    };
}

/** Build the HTML for the cache items grid in the settings dialog. */
function buildCacheItemsHtml(cacheItems) {
    return cacheItems.map(e => `
            <div class="cache-item" style="border: 1px solid #eee; border-radius: 8px; padding: 12px;">
                <div style="font-weight: bold; margin-bottom: 8px;">${e.text}</div>
                <div style="display: flex; gap: 8px;">
                    <a class="menu-btn clean-btn" data-key="${e.key}" style="background-color:#448cc2; flex:1; text-align:center;" title="${e.title}">
                        <span>清理</span>
                    </a>
                    <a class="menu-btn view-btn" data-key="${e.key}" style="background-color:#b2bec0; flex:1; text-align:center;" >
                        <span>查看</span>
                    </a>
                </div>
            </div>
        `).join("");
}

/** Build the quality options HTML for the video quality select. */
function buildVideoQualityOptions() {
    let a = "";
    L.forEach(e => {
        e.canSelect && (a += `<option value="${e.quality}">${e.text}</option>`);
    });
    return a;
}

/** Build the main settings dialog HTML template. */
function buildSettingDialogHtml(activePanel, cacheItems, coverButtonPlugin) {
    const n = buildCacheItemsHtml(cacheItems);
    const a = buildVideoQualityOptions();
    const isMobile = utils.isMobileMode();
    const sidebarDir = isMobile ? "column" : "row";
    return `
            <div style="display: flex; flex-direction: ${sidebarDir}; height: 100%;">
                <div class="jhs-mobile-sidebar" style="width: 140px; flex-shrink: 0; padding: 15px 0; background: #f5f5f5; border-right: 1px solid #ddd;">
                    <div class="side-menu-item ${"backup-panel" === activePanel ? "active" : ""}" data-panel="backup-panel">数据备份</div>
                    <div class="side-menu-item ${"base-panel" === activePanel ? "active" : ""}" data-panel="base-panel">基础配置</div>
                    <div class="side-menu-item ${"filter-panel" === activePanel ? "active" : ""}" data-panel="filter-panel">屏蔽配置</div>
                    <div class="side-menu-item ${"task-panel" === activePanel ? "active" : ""}" data-panel="task-panel">定时任务</div>
                    <div class="side-menu-item ${"domain-panel" === activePanel ? "active" : ""}" data-panel="domain-panel" title="第三方视频资源域名配置">外部网站</div>

                    <div class="side-menu-item ${"cache-panel" === activePanel ? "active" : ""}" data-panel="cache-panel">清理缓存</div>
                </div>

                <div style="flex: 1; display: flex; flex-direction: column; height: 100%; ">
                    <div style="flex: 1; margin: 0 10px; padding-bottom: 20px;overflow-y: auto;overflow-x: hidden">


                        <div id="backup-panel" class="content-panel" style="display: ${"backup-panel" === activePanel ? "block" : "none"};">
                            <div style="margin-bottom: 20px">
                                <a id="importBtn" class="menu-btn" style="background-color:#d25a88"><span>导入数据</span></a>
                                <a id="exportBtn" class="menu-btn" style="background-color:#85d0a3"><span>导出数据</span></a>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label">WebDav备份</span>
                                <div>
                                    <a id="webdavBackupListBtn" class="menu-btn" style="background-color:#5d87c2"><span>查看备份</span></a>
                                    <a id="webdavBackupBtn" class="menu-btn" style="background-color:#64bb69"><span>备份数据</span></a>
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">服务地址:</span>
                                <div class="form-content">
                                    <input id="webDavUrl">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">用户名:</span>
                                <div class="form-content">
                                    <input id="webDavUsername">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">密码:</span>
                                <div class="form-content">
                                    <input id="webDavPassword">
                                </div>
                            </div>
                        </div>


                        <div id="base-panel" class="content-panel" style="display: ${"base-panel" === activePanel ? "block" : "none"};">
                            <div class="setting-item">
                                <span class="setting-label">打开待鉴定窗口数:</span>
                                <div class="form-content">
                                    <input type="number" id="waitCheckCount" min="1" max="20" style="width: 100%;">
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label">已鉴定标签展示位置:</span>
                                <div class="form-content">
                                    <select id="tagPosition">
                                        <option value="rightTop">右上</option>
                                        <option value="leftTop">左上</option>
                                    </select>
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">
                                    鉴定补录演员信息 <span data-tip="在列表页进行鉴定是获取不到演员名称的, 开启后, 额外解析详情页补录演员名称, 因发请求解析费时, 会被以往慢1秒左右">(?)</span>
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableSaveActressCarInfo" class="mini-switch">
                                </div>
                            </div>

                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div class="setting-item" style="margin-top:10px">
                                <span class="setting-label">
                                    封面快捷按钮
                                </span>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">
                                    ${coverButtonPlugin.screenSvg}长缩略图:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableScreenSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">
                                    ${coverButtonPlugin.videoSvg}预览视频:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableVideoSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">
                                    ${coverButtonPlugin.handleSvg}鉴定按钮:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableHandleSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">
                                    ${coverButtonPlugin.siteSvg}第三方跳转:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableSiteSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label" style="display:flex; align-items:center; gap:5px">
                                    ${coverButtonPlugin.copySvg}复制按钮:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableCopySvg" class="mini-switch">
                                </div>
                            </div>

                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div class="setting-item">
                                <span class="setting-label">预览视频默认画质:</span>
                                <div class="form-content">
                                    <select id="videoQuality">
                                        ${a}
                                    </select>
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label">评论区条数:</span>
                                <div class="form-content">
                                    <select id="reviewCount">
                                        <option value="10">10条</option>
                                        <option value="20">20条</option>
                                        <option value="30">30条</option>
                                        <option value="40">40条</option>
                                        <option value="50">50条</option>
                                    </select>
                                </div>
                            </div>

                            <div class="setting-item ${r ? "" : "do-hide"}">
                                <span class="setting-label">
                                    高亮已收藏演员 <span data-tip="详情页, 对已收藏的演员进行边框高亮提醒">(?)</span>
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableFavoriteActresses" class="mini-switch">
                                </div>
                            </div>

                            <div class="setting-item ${r ? "" : "do-hide"}">
                                <span id="highlightedTagLabel" class="setting-label">
                                    分类标签|高亮演员-边框样式:
                                </span>
                                <div class="form-content" style="display: flex; align-items: center;">
                                    <input type="number" id="highlightedTagNumber" min="0" max="20">
                                    <input type="color" id="highlightedTagColor">
                                </div>
                            </div>

                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div class="setting-item">
                                <span class="setting-label">请求超时时间(毫秒):</span>
                                <div class="form-content">
                                    <input type="number" id="httpTimeout" min="1000" max="10000" style="width: 100%;">
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label">请求失败重试次数:</span>
                                <div class="form-content">
                                    <input type="number" id="httpRetryCount" min="0" max="10" style="width: 100%;">
                                </div>
                            </div>

                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div class="setting-item">
                                <span class="setting-label">
                                    启用控制台日志:
                                </span>
                                <div class="form-content">
                                    <select id="enableClog">
                                        <option value="no">禁用</option>
                                        <option value="yes">开启</option>
                                    </select>
                                </div>
                            </div>

                            <div class="setting-item">
                                <span class="setting-label">日志最大行数:</span>
                                <div class="form-content">
                                    <input type="number" id="clogMsgCount" min="100" max="3000" style="width: 100%;">
                                </div>
                            </div>


                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div class="setting-item">
                                <span class="setting-label">
                                    移动端模式 <span data-tip="auto=自动检测设备, on=强制移动端UI, off=强制桌面端UI">(?)</span>
                                </span>
                                <div class="form-content">
                                    <select id="mobileMode">
                                        <option value="auto">自动检测</option>
                                        <option value="on">强制开启</option>
                                        <option value="off">强制关闭</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div id="task-panel" class="content-panel" style="display: ${"task-panel" === activePanel ? "block" : "none"};">

                            <div class="setting-item">
                                <span class="setting-label">请求并发数量:</span>
                                <div class="form-content">
                                    <input type="number" id="checkConcurrencyCount" min="2" max="5" style="width: 100%;">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">请求间隔时间(毫秒):</span>
                                <div class="form-content">
                                    <input type="number" id="checkRequestSleep" min="0" max="3000" style="width: 100%;">
                                </div>
                            </div>

                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div id="setting-blacklist" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;">
                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动检测屏蔽黑名单演员</span>
                                <div class="setting-item">
                                    <span class="setting-label">
                                        任务开关: <span data-tip="变更后, 刷新页面生效">(?)</span>
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckBlacklist">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkBlacklist_intervalTime">
                                            <option value="2">每2小时</option>
                                            <option value="3">每3小时</option>
                                            <option value="6">每6小时</option>
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <span class="setting-label">检测规则:</span>
                                    <div class="form-content">
                                         <select id="checkBlacklist_ruleTime">
                                            <option value="0">全部检测</option>
                                            <option value="8760">不检测停更1年以上</option>
                                            <option value="17520">不检测停更2年以上</option>
                                            <option value="26280">不检测停更3年以上</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="setting-checkFavoriteActress" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;" class="${r ? "" : "do-hide"}">
                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动同步已收藏的演员</span>
                                <div class="setting-item">
                                    <span class="setting-label">
                                        任务开关: <span data-tip="变更后, 刷新页面生效">(?)</span>
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckFavoriteActress">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkFavoriteActress_IntervalTime">
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="setting-checkNewVideo" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 15px;" class="${r ? "" : "do-hide"}">
                                <span style="font-size: 14px; font-weight: bold; padding:3px">自动检测已收藏演员的最新作品</span>
                                <div class="setting-item">
                                    <span class="setting-label">
                                        任务开关: <span data-tip="变更后, 刷新页面生效">(?)</span>
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckNewVideo">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkNewVideo_intervalTime">
                                            <option value="2">每2小时</option>
                                            <option value="3">每3小时</option>
                                            <option value="6">每6小时</option>
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="setting-item">
                                    <span class="setting-label">检测规则:</span>
                                    <div class="form-content">
                                         <select id="checkNewVideo_ruleTime">
                                            <option value="0">全部检测</option>
                                            <option value="8760">不检测停更1年以上</option>
                                            <option value="17520">不检测停更2年以上</option>
                                            <option value="26280">不检测停更3年以上</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="domain-panel" class="content-panel" style="display: ${"domain-panel" === activePanel ? "block" : "none"};">
                            <div class="setting-item">
                                <span class="setting-label">域名 - MissAv:</span>
                                <div class="form-content">
                                    <input id="missAvUrl">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">域名 - Jable:</span>
                                <div class="form-content">
                                    <input id="jableUrl">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">域名 - Avgle:</span>
                                <div class="form-content">
                                    <input id="avgleUrl">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">域名 - JavTrailer:</span>
                                <div class="form-content">
                                    <input id="javTrailersUrl">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">域名 - 123Av:</span>
                                <div class="form-content">
                                    <input id="av123Url">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">域名 - JavDb:</span>
                                <div class="form-content">
                                    <input id="javDbUrl">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">域名 - JavBus:</span>
                                <div class="form-content">
                                    <input id="javBusUrl">
                                </div>
                            </div>
                            <div class="setting-item">
                                <span class="setting-label">域名 - SupJav:</span>
                                <div class="form-content">
                                    <input id="supJavUrl">
                                </div>
                            </div>
                        </div>


                        <div id="filter-panel" class="content-panel" style="display: ${"filter-panel" === activePanel ? "block" : "none"};">
                            <div class="setting-item">
                                <span class="setting-label">
                                     启用划词屏蔽 <span data-tip="视频详情页中, 标题或评论区选中文字, 按右键可快捷加入屏蔽词">(?) </span>
                                </span>
                                <div style="display: flex">
                                    <input type="checkbox" id="enableTitleSelectFilter" class="mini-switch">
                                </div>
                            </div>

                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div id="reviewKeywordContainer">
                                <div class="setting-item">
                                    <span class="setting-label">评论区屏蔽词:</span>
                                    <div style="display: flex">
                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">
                                        <button class="add-tag-btn">添加</button>
                                    </div>
                                </div>
                                <div class="tag-box"> </div>
                            </div>

                            <hr style="border: 0; height: 1px; margin:20px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                            <div id="filterKeywordContainer">
                                <div class="setting-item">
                                    <span class="setting-label">视频标题屏蔽词:</span>
                                    <div style="display: flex">
                                        <input type="text" class="keyword-input" placeholder="添加屏蔽词">
                                        <button class="add-tag-btn">添加</button>
                                    </div>
                                </div>
                                <div class="tag-box"> </div>
                            </div>
                        </div>
                        <div id="cache-panel" class="content-panel" style="display: ${"cache-panel" === activePanel ? "block" : "none"};">
                            <h1 style="text-align:center;font-size: 20px;font-weight: bold">以下操作, 不会对核心数据造成影响</h1>
                            <br/>
                            <div class="jhs-cache-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px;">
                                ${n}
                            </div>
                            <div id="cache-data-display" style="margin-top: 20px; display: none;">
                                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; max-height: 400px; overflow: auto;"></pre>
                            </div>
                        </div>
                    </div>

                    <div class="jhs-setting-footer" style="flex-shrink: 0; padding: 15px 20px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #eee; background: white;">
                        <button id="saveBtn">保存设置</button>
                        <button id="clean-all" style="display: none">清理全部缓存</button>
                    </div>
                </div>
            </div>
        `;
}

/** Inject the Data Health sidebar item and panel HTML into the dialog. */
function injectHealthPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="health-panel"]').length && e.append('<div class="side-menu-item" data-panel="health-panel">数据体检</div>');
    const t = $(".content-panel").parent();
    t.length && !$("#health-panel").length && t.append(`
            <div id="health-panel" class="content-panel" style="display:none;">
                <div style="display:flex; gap:8px; margin-bottom:12px;">
                    <a id="runHealthCheckBtn" class="menu-btn" style="background-color:#448cc2"><span>重新体检</span></a>
                    <a id="repairHealthBtn" class="menu-btn" style="background-color:#64bb69"><span>备份并修复</span></a>
                </div>
                <div id="health-data-display" style="background:#f8f9fa; border:1px solid #ddd; border-radius:5px; padding:12px; min-height:180px;">点击重新体检查看结果</div>
            </div>
        `);
}

/** Inject the Plugin Management sidebar item and panel HTML into the dialog. */
function injectPluginMgmtPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="plugin-mgmt-panel"]').length && e.append('<div class="side-menu-item" data-panel="plugin-mgmt-panel">插件管理</div>');
    const t = $(".content-panel").parent();
    if (!t.length || $("#plugin-mgmt-panel").length) return;
    let i = '<div id="plugin-mgmt-panel" class="content-panel" style="display:none;">';
    i += '<div style="display:flex;gap:8px;margin-bottom:15px;flex-wrap:wrap;">';
    i += '<div style="flex:1;min-width:120px;background:#f0f7ff;border-radius:8px;padding:10px;text-align:center"><div id="pm-total" style="font-size:20px;font-weight:bold;color:#25b1dc">0</div><div style="font-size:12px;color:#888">总插件数</div></div>';
    i += '<div style="flex:1;min-width:120px;background:#f0fff4;border-radius:8px;padding:10px;text-align:center"><div id="pm-enabled" style="font-size:20px;font-weight:bold;color:#7bc73b">0</div><div style="font-size:12px;color:#888">已启用</div></div>';
    i += '<div style="flex:1;min-width:120px;background:#fff5f5;border-radius:8px;padding:10px;text-align:center"><div id="pm-disabled" style="font-size:20px;font-weight:bold;color:#de3333">0</div><div style="font-size:12px;color:#888">已禁用</div></div>';
    i += '</div>';
    i += '<p style="color:#666;font-size:0.85em;margin-bottom:10px;">禁用插件后需刷新页面生效。核心插件不可禁用。</p>';
    i += '<div id="plugin-mgmt-list"></div>';
    i += '<hr style="border:0;height:1px;margin:20px 0;background-image:linear-gradient(to right,rgba(0,0,0,0),rgba(159,137,137,0.75),rgba(0,0,0,0));"/>';
    i += '<h3 style="font-size:15px;font-weight:bold;margin-bottom:10px;">插件执行耗时</h3>';
    i += '<p style="color:#666;font-size:0.85em;margin-bottom:8px;">页面加载时各插件 handle() 的执行时间。</p>';
    i += '<div id="plugin-timing-table"></div>';
    i += '<hr style="border:0;height:1px;margin:20px 0;background-image:linear-gradient(to right,rgba(0,0,0,0),rgba(159,137,137,0.75),rgba(0,0,0,0));"/>';
    i += '<h3 style="font-size:15px;font-weight:bold;margin-bottom:10px;">错误日志</h3>';
    i += '<div style="display:flex;gap:8px;margin-bottom:8px;"><a id="pm-clear-log" class="menu-btn" style="background-color:#e74c3c"><span>清空日志</span></a></div>';
    i += '<div id="plugin-error-log" style="max-height:250px;overflow:auto;background:#f8f9fa;border:1px solid #ddd;border-radius:5px;padding:10px;font-size:13px;">无错误记录</div>';
    i += '<hr style="border:0;height:1px;margin:20px 0;background-image:linear-gradient(to right,rgba(0,0,0,0),rgba(159,137,137,0.75),rgba(0,0,0,0));"/>';
    i += '<h3 style="font-size:15px;font-weight:bold;margin-bottom:10px;">缓存命中率</h3>';
    i += '<div id="cache-hit-stats" style="background:#f8f9fa;border:1px solid #ddd;border-radius:5px;padding:10px;"></div>';
    i += '</div>';
    t.append(i);
}

/** Inject the Snapshot sidebar item and panel HTML into the dialog. */
function injectSnapshotPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="snapshot-panel"]').length && e.append('<div class="side-menu-item" data-panel="snapshot-panel">恢复点</div>');
    const t = $(".content-panel").parent();
    if (!t.length || $("#snapshot-panel").length) return;
    let n = '<div id="snapshot-panel" class="content-panel" style="display:none;">';
    n += '<div style="display:flex;gap:8px;margin-bottom:15px;">';
    n += '<a id="createSnapshotBtn" class="menu-btn" style="background-color:#64bb69"><span>创建快照</span></a>';
    n += '</div>';
    n += '<p style="color:#666;font-size:0.85em;margin-bottom:10px;">快照保存当前全部数据状态，可用于恢复。最多保留 10 个，超出自动清理最旧的。</p>';
    n += '<div id="snapshot-list"></div>';
    n += '</div>';
    t.append(n);
}

/** Inject the Network/External Requests sidebar item and panel HTML into the dialog. */
function injectNetworkPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="network-panel"]').length && e.append('<div class="side-menu-item" data-panel="network-panel">外部请求</div>');
    const t = $(".content-panel").parent();
    if (!t.length || $("#network-panel").length) return;
    let n = '<div id="network-panel" class="content-panel" style="display:none;">';
    n += '<h3 style="font-size:15px;font-weight:bold;margin-bottom:10px;">熔断器配置</h3>';
    n += '<p style="color:#666;font-size:0.85em;margin-bottom:10px;">连续请求失败达到阈值后，自动停止对该站点的请求，避免拖慢整体体验。</p>';
    n += '<div class="setting-item"><span class="setting-label">熔断阈值(次):</span><div class="form-content"><input type="number" id="circuitBreakerThreshold" min="2" max="10" style="width:100%;"></div></div>';
    n += '<div class="setting-item"><span class="setting-label">冷却时间(秒):</span><div class="form-content"><input type="number" id="circuitBreakerCooldownSec" min="10" max="300" style="width:100%;"></div></div>';
    n += '<div style="display:flex;gap:8px;margin:10px 0;"><a id="resetAllBreakersBtn" class="menu-btn" style="background-color:#e74c3c"><span>重置全部熔断</span></a></div>';
    n += '<hr style="border:0;height:1px;margin:20px 0;background-image:linear-gradient(to right,rgba(0,0,0,0),rgba(159,137,137,0.75),rgba(0,0,0,0));"/>';
    n += '<h3 style="font-size:15px;font-weight:bold;margin-bottom:10px;">站点健康状态</h3>';
    n += '<p style="color:#666;font-size:0.85em;margin-bottom:10px;">各外部站点的熔断状态和请求统计。</p>';
    n += '<div id="site-health-table"></div>';
    n += '<hr style="border:0;height:1px;margin:20px 0;background-image:linear-gradient(to right,rgba(0,0,0,0),rgba(159,137,137,0.75),rgba(0,0,0,0));"/>';
    n += '<h3 style="font-size:15px;font-weight:bold;margin-bottom:10px;">域名使用统计</h3>';
    n += '<p style="color:#666;font-size:0.85em;margin-bottom:10px;">脚本实际请求过的域名及次数。</p>';
    n += '<div style="display:flex;gap:8px;margin-bottom:8px;"><a id="clearDomainStatsBtn" class="menu-btn" style="background-color:#e74c3c"><span>清空统计</span></a></div>';
    n += '<div id="domain-stats-table"></div>';
    n += '</div>';
    t.append(n);
}

/** Build the HTML for the hover dropdown quick-settings panel. */
function buildSimpleSettingHtml() {
    return `
             <div class="jhs-scrollbar" style="margin-top:20px;max-height:90vh; overflow-y:auto;">
                <div style="margin: 0 10px;">
                    <div class="setting-item">
                        <span class="setting-label">
                            显示已鉴定内容:
                        </span>
                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽单番号: </span><input type="checkbox" id="showFilterItem" class="mini-switch"><br/>
                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽演员: </span><input type="checkbox" id="showFilterActorItem" class="mini-switch"><br/>
                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">屏蔽关键词: </span><input type="checkbox" id="showFilterKeywordItem" class="mini-switch"><br/>
                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">收藏: </span><input type="checkbox" id="showFavoriteItem" class="mini-switch"><br/>
                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已下载: </span><input type="checkbox" id="showHasDownItem" class="mini-switch"><br/>
                            <span style="display:inline-block; width: 80px; font-size:13px; font-weight:bold; text-align: left">已观看: </span><input type="checkbox" id="showHasWatchItem" class="mini-switch"><br/>
                        </div>
                    </div>
                    <div class="setting-item">
                        <span class="setting-label">
                            <span data-tip="快速显示所有已鉴定内容,减少对以上开关的频繁操作">(?) </span> 显示所有:
                        </span>
                        <div class="form-content" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;">
                            <input type="checkbox" id="showAllItem" class="mini-switch">
                        </div>
                    </div>



                    <div class="setting-item">
                        <span class="setting-label">鉴定后立即关闭页面:</span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="needClosePage" class="mini-switch">
                        </div>
                    </div>

                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                    <div class="setting-item">
                        <span class="setting-label">
                             <span data-tip="使用瀑布流模式, 排序方式将调整为默认">(?) </span>瀑布流模式:
                        </span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="autoPage" class="mini-switch">
                        </div>
                    </div>

                    <div class="setting-item">
                        <span class="setting-label">启用标题翻译:</span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="translateTitle" class="mini-switch">
                        </div>
                    </div>

                    <div class="setting-item">
                        <span class="setting-label">启用悬浮大图:</span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="hoverBigImg" class="mini-switch">
                        </div>
                    </div>


                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                    ${r ? `
                    <div class="setting-item">
                        <span class="setting-label">
                            <span data-tip="详情页是否展示女优年龄、三围等信息">(?) </span>加载女优信息:
                        </span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="enableLoadActressInfo" class="mini-switch">
                        </div>
                    </div>` : ""}

                    <div class="setting-item">
                        <span class="setting-label">
                            <span data-tip="详情页显示外部网站入口；点击检测外部站点后才请求第三方站点">(?) </span>显示外部网站:
                        </span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="enableLoadOtherSite" class="mini-switch">
                        </div>
                    </div>

                    <div class="setting-item">
                        <span class="setting-label">
                            <span data-tip="详情页图片区首列位置加载长缩略图">(?) </span>加载长缩略图:
                        </span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="enableLoadScreenShot" class="mini-switch">
                        </div>
                    </div>

                     <div class="setting-item">
                        <span class="setting-label">
                            <span data-tip="详情页解析更多更高画质的预览视频">(?) </span>更高画质预览视频:
                        </span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="enableLoadPreviewVideo" class="mini-switch">
                        </div>
                    </div>

                    <hr style="border: 0; height: 1px; margin:10px 0;background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0));"/>

                    <div class="setting-item">
                        <span class="setting-label">
                            <span data-tip="列数6以上,建议开启竖图">(?) </span>竖图模式:
                        </span>
                        <div class="form-content" style="text-align: right;">
                            <input type="checkbox" id="enableVerticalModel" class="mini-switch">
                        </div>
                    </div>

                    <div class="setting-item">
                        <span class="setting-label">页面列数: <span id="showContainerColumns"></span></span>
                        <div class="form-content">
                            <input type="range" id="containerColumns" min="2" max="10" step="1" style="padding:5px 0">
                        </div>
                    </div>

                    <div class="setting-item">
                        <span class="setting-label">页面宽度: <span id="showContainerWidth"></span></span>
                        <div class="form-content">
                            <input type="range" id="containerWidth" min="0" max="30" step="1" style="padding:5px 0">
                        </div>
                    </div>
                </div>
                <div style="padding: 0 20px 15px; text-align: right; border-top: 1px solid #eee;">
                    <button id="helpBtn" style="float:left;">常见问题</button>
                    <button id="moreBtn">更多设置</button>
                </div>
            </div>
        `;
}
