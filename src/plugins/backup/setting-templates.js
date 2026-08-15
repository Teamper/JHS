/**
 * Build the plugin categories configuration shared between inject and render.
 * Returns { categories, corePlugins }.
 */
function getPluginCategories() {
    const pluginMeta = {
        SettingPlugin:["设置中心","core"], StatsPlugin:["统计中心","core"], MobileBottomBarPlugin:["工具栏与移动操作","core"],
        ListPagePlugin:["列表状态处理","list"], NavBarPlugin:["JavDB 导航","list"], BusNavBarPlugin:["JavBus 导航","list"], ListPageButtonPlugin:["列表操作","list"], HighlightMagnetPlugin:["磁力标记","list"], FoldCategoryPlugin:["分类折叠","list"], AutoPagePlugin:["自动翻页","list"], HitShowPlugin:["热播榜单","list"], TOP250Plugin:["TOP 250","list"],
        DetailPagePlugin:["JavDB 详情页","detail"], BusDetailPagePlugin:["JavBus 详情页","detail"], DetailPageButtonPlugin:["详情操作","detail"], ReviewPlugin:["评论","detail"], RelatedPlugin:["相关影片","detail"], TranslatePlugin:["标题翻译","detail"], WantAndWatchedVideosPlugin:["想看与看过","detail"],
        CoverButtonPlugin:["封面快捷操作","media"], PreviewVideoPlugin:["JavDB 预览视频","media"], BusPreviewVideoPlugin:["JavBus 预览视频","media"], ScreenShotPlugin:["剧照","media"], BusImgPlugin:["JavBus 图片适配","media"], ActressInfoPlugin:["演员资料","media"], SearchByImagePlugin:["以图搜图","media"],
        HistoryPlugin:["鉴定记录","data"], BlacklistPlugin:["黑名单","data"], FilterTitleKeywordPlugin:["关键词筛选","data"], FavoriteActressesPlugin:["演员收藏","data"], NewVideoPlugin:["新作品检测","data"], TaskPlugin:["定时任务","data"],
        OtherSitePlugin:["外部站点","network"], Fc2Plugin:["FC2 详情","network"], Fc2By123AvPlugin:["FC2 123AV","network"], MagnetHubPlugin:["磁力聚合","network"], JavTrailersPlugin:["预告片","network"], SubTitleCatPlugin:["字幕搜索","network"], OneTwoThreeOfflinePlugin:["123 云盘离线","network"]
    };
    const group = (key, label) => ({ label, plugins:Object.entries(pluginMeta).filter((e => e[1][1] === key)).map((e => e[0])) });
    return {
        categories: {
            core:group("core", "基础核心"), list:group("list", "列表页"), detail:group("detail", "详情页"),
            media:group("media", "媒体"), data:group("data", "数据"), network:group("network", "网络")
        },
        corePlugins: ["SettingPlugin","StatsPlugin","MobileBottomBarPlugin"], pluginMeta
    };
}

/** Build the HTML for the cache items grid in the settings dialog. */
function buildCacheItemsHtml(cacheItems) {
    return cacheItems.map(e => `
            <div class="cache-item">
                <div class="cache-item__title">${e.text}</div>
                <div class="cache-item__actions">
                    <button type="button" class="jhs-btn jhs-btn--secondary clean-btn" data-key="${e.key}" title="${e.title}">
                        <span>清理</span>
                    </button>
                    <button type="button" class="jhs-btn jhs-btn--secondary view-btn" data-key="${e.key}" >
                        <span>查看</span>
                    </button>
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
    return `
            <div class="jhs-setting-layout jhs-ui">
                <nav class="jhs-mobile-sidebar" aria-label="设置分类">
                    <button type="button" class="jhs-btn side-menu-item ${"backup-panel" === activePanel ? "active" : ""}" data-panel="backup-panel" aria-controls="backup-panel">数据备份</button>
                    <button type="button" class="jhs-btn side-menu-item ${"base-panel" === activePanel ? "active" : ""}" data-panel="base-panel" aria-controls="base-panel">基础配置</button>
                    <button type="button" class="jhs-btn side-menu-item ${"filter-panel" === activePanel ? "active" : ""}" data-panel="filter-panel" aria-controls="filter-panel">屏蔽配置</button>
                    <button type="button" class="jhs-btn side-menu-item ${"task-panel" === activePanel ? "active" : ""}" data-panel="task-panel" aria-controls="task-panel">定时任务</button>
                    <button type="button" class="jhs-btn side-menu-item ${"domain-panel" === activePanel ? "active" : ""}" data-panel="domain-panel" aria-controls="domain-panel" title="第三方视频资源域名配置">外部网站</button>

                    <button type="button" class="jhs-btn side-menu-item ${"cache-panel" === activePanel ? "active" : ""}" data-panel="cache-panel" aria-controls="cache-panel">清理缓存</button>
                </nav>

                <div class="jhs-setting-main">
                    <div class="jhs-setting-body">


                        <div id="backup-panel" class="content-panel ${"backup-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>数据备份</h3><p>导入、导出和远程备份 JHS 数据。</p></header><div class="jhs-setting-group">
                            <div class="jhs-toolbar">
                                <button type="button" id="importBtn" class="jhs-btn jhs-btn--secondary"><span>导入数据</span></button>
                                <button type="button" id="exportBtn" class="jhs-btn jhs-btn--primary"><span>导出数据</span></button>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">WebDav备份</span>
                                <div>
                                    <button type="button" id="webdavBackupListBtn" class="jhs-btn jhs-btn--secondary"><span>查看备份</span></button>
                                    <button type="button" id="webdavBackupBtn" class="jhs-btn jhs-btn--primary"><span>备份数据</span></button>
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">服务地址:</span>
                                <div class="form-content">
                                    <input type="url" id="webDavUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">用户名:</span>
                                <div class="form-content">
                                    <input type="text" id="webDavUsername" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">密码:</span>
                                <div class="form-content">
                                    <input type="password" id="webDavPassword" class="jhs-field">
                                </div>
                            </div>
                        </div></section>
                        </div>


                        <div id="base-panel" class="content-panel ${"base-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>基础配置</h3><p>配置列表显示、媒体加载、网络和主题。</p></header><div class="jhs-setting-group">
                            <div class="jhs-setting-row">
                                <span class="setting-label">打开待鉴定窗口数:</span>
                                <div class="form-content">
                                    <input type="number" id="waitCheckCount" class="jhs-field" min="1" max="20">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">已鉴定标签展示位置:</span>
                                <div class="form-content">
                                    <select id="tagPosition" class="jhs-select-source">
                                        <option value="rightTop">右上</option>
                                        <option value="leftTop">左上</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    鉴定补录演员信息
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableSaveActressCarInfo" class="mini-switch">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    封面快捷按钮
                                </span>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.screenSvg}长缩略图:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableScreenSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.videoSvg}预览视频:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableVideoSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.handleSvg}鉴定按钮:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableHandleSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.siteSvg}第三方跳转:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableSiteSvg" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label jhs-setting-label-inline">
                                    ${coverButtonPlugin.copySvg}复制按钮:
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableCopySvg" class="mini-switch">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">预览视频默认画质:</span>
                                <div class="form-content">
                                    <select id="videoQuality" class="jhs-select-source">
                                        ${a}
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">评论区条数:</span>
                                <div class="form-content">
                                    <select id="reviewCount" class="jhs-select-source">
                                        <option value="10">10条</option>
                                        <option value="20">20条</option>
                                        <option value="30">30条</option>
                                        <option value="40">40条</option>
                                        <option value="50">50条</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row ${r ? "" : "do-hide"}">
                                <span class="setting-label">
                                    高亮已收藏演员
                                </span>
                                <div class="form-content">
                                    <input type="checkbox" id="enableFavoriteActresses" class="mini-switch">
                                </div>
                            </div>

                            <div class="jhs-setting-row ${r ? "" : "do-hide"}">
                                <span id="highlightedTagLabel" class="setting-label">
                                    分类标签|高亮演员-边框样式:
                                </span>
                                <div class="form-content">
                                    <input type="number" id="highlightedTagNumber" class="jhs-field" min="0" max="20">
                                    <input type="color" id="highlightedTagColor">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">请求超时时间(毫秒):</span>
                                <div class="form-content">
                                    <input type="number" id="httpTimeout" class="jhs-field" min="1000" max="10000">
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">请求失败重试次数:</span>
                                <div class="form-content">
                                    <input type="number" id="httpRetryCount" class="jhs-field" min="0" max="10">
                                </div>
                            </div>



                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    启用控制台日志:
                                </span>
                                <div class="form-content">
                                    <select id="enableClog" class="jhs-select-source">
                                        <option value="no">禁用</option>
                                        <option value="yes">开启</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">日志最大行数:</span>
                                <div class="form-content">
                                    <input type="number" id="clogMsgCount" class="jhs-field" min="100" max="3000">
                                </div>
                            </div>




                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    移动端模式
                                </span>
                                <div class="form-content">
                                    <select id="mobileMode" class="jhs-select-source">
                                        <option value="auto">自动检测</option>
                                        <option value="on">强制开启</option>
                                        <option value="off">强制关闭</option>
                                    </select>
                                </div>
                            </div>

                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                    外观主题
                                </span>
                                <div class="form-content">
                                    <select id="themeMode" class="jhs-select-source">
                                        <option value="light">浅色</option>
                                        <option value="dark">深色</option>
                                        <option value="auto">跟随系统</option>
                                    </select>
                                </div>
                            </div>
                            <div class="jhs-setting-row" data-description="分别控制各类已鉴定内容是否继续显示。">
                                <span class="setting-label">列表状态显示</span>
                                <div class="form-content jhs-setting-toggle-grid">
                                    <label><input type="checkbox" id="showFilterItem" class="mini-switch"><span>屏蔽单番号</span></label>
                                    <label><input type="checkbox" id="showFilterActorItem" class="mini-switch"><span>屏蔽演员</span></label>
                                    <label><input type="checkbox" id="showFilterKeywordItem" class="mini-switch"><span>屏蔽关键词</span></label>
                                    <label><input type="checkbox" id="showFavoriteItem" class="mini-switch"><span>收藏</span></label>
                                    <label><input type="checkbox" id="showHasDownItem" class="mini-switch"><span>已下载</span></label>
                                    <label><input type="checkbox" id="showHasWatchItem" class="mini-switch"><span>已观看</span></label>
                                </div>
                            </div>
                            <div class="jhs-setting-row ${r ? "" : "do-hide"}"><span class="setting-label">加载女优信息</span><div class="form-content"><input type="checkbox" id="enableLoadActressInfo" class="mini-switch"></div></div>
                            <div class="jhs-setting-row"><span class="setting-label">竖图模式</span><div class="form-content"><input type="checkbox" id="enableVerticalModel" class="mini-switch"></div></div>
                            <div class="jhs-setting-row"><span class="setting-label">页面列数：<span id="showContainerColumns"></span></span><div class="form-content"><input type="range" class="jhs-range" id="containerColumns" min="2" max="10" step="1"></div></div>
                            <div class="jhs-setting-row"><span class="setting-label">页面宽度：<span id="showContainerWidth"></span></span><div class="form-content"><input type="range" class="jhs-range" id="containerWidth" min="0" max="30" step="1"></div></div>
                        </div></section>
                        </div>

                        <div id="task-panel" class="content-panel ${"task-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>定时任务</h3><p>配置黑名单、演员同步和新作品检测。</p></header><div class="jhs-setting-group">

                            <div class="jhs-setting-row">
                                <span class="setting-label">请求并发数量:</span>
                                <div class="form-content">
                                    <input type="number" id="checkConcurrencyCount" class="jhs-field" min="2" max="5">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">请求间隔时间(毫秒):</span>
                                <div class="form-content">
                                    <input type="number" id="checkRequestSleep" class="jhs-field" min="0" max="3000">
                                </div>
                            </div>



                            <div id="setting-blacklist" class="jhs-setting-rows">
                                <h4 class="jhs-setting-subtitle">自动检测屏蔽黑名单演员</h4>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">
                                        任务开关:
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckBlacklist" class="jhs-select-source">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkBlacklist_intervalTime" class="jhs-select-source">
                                            <option value="2">每2小时</option>
                                            <option value="3">每3小时</option>
                                            <option value="6">每6小时</option>
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">检测规则:</span>
                                    <div class="form-content">
                                         <select id="checkBlacklist_ruleTime" class="jhs-select-source">
                                            <option value="0">全部检测</option>
                                            <option value="8760">不检测停更1年以上</option>
                                            <option value="17520">不检测停更2年以上</option>
                                            <option value="26280">不检测停更3年以上</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="setting-checkFavoriteActress" class="jhs-setting-rows ${r ? "" : "do-hide"}">
                                <h4 class="jhs-setting-subtitle">自动同步已收藏的演员</h4>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">
                                        任务开关:
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckFavoriteActress" class="jhs-select-source">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkFavoriteActress_IntervalTime" class="jhs-select-source">
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div id="setting-checkNewVideo" class="jhs-setting-rows ${r ? "" : "do-hide"}">
                                <h4 class="jhs-setting-subtitle">自动检测已收藏演员的最新作品</h4>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">
                                        任务开关:
                                    </span>
                                    <div class="form-content">
                                        <select id="enableCheckNewVideo" class="jhs-select-source">
                                            <option value="no">禁用</option>
                                            <option value="yes">开启</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">任务间隔时间:</span>
                                    <div class="form-content">
                                         <select id="checkNewVideo_intervalTime" class="jhs-select-source">
                                            <option value="2">每2小时</option>
                                            <option value="3">每3小时</option>
                                            <option value="6">每6小时</option>
                                            <option value="12">每12小时</option>
                                            <option value="24">每24小时</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="jhs-setting-row">
                                    <span class="setting-label">检测规则:</span>
                                    <div class="form-content">
                                         <select id="checkNewVideo_ruleTime" class="jhs-select-source">
                                            <option value="0">全部检测</option>
                                            <option value="8760">不检测停更1年以上</option>
                                            <option value="17520">不检测停更2年以上</option>
                                            <option value="26280">不检测停更3年以上</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div></section>
                        </div>

                        <div id="domain-panel" class="content-panel ${"domain-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>外部网站</h3><p>配置外部资源来源、域名与网络。</p></header><div class="jhs-setting-group">
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - MissAv:</span>
                                <div class="form-content">
                                    <input type="url" id="missAvUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - Jable:</span>
                                <div class="form-content">
                                    <input type="url" id="jableUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - Avgle:</span>
                                <div class="form-content">
                                    <input type="url" id="avgleUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - JavTrailer:</span>
                                <div class="form-content">
                                    <input type="url" id="javTrailersUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - 123Av:</span>
                                <div class="form-content">
                                    <input type="url" id="av123Url" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - JavDb:</span>
                                <div class="form-content">
                                    <input type="url" id="javDbUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - JavBus:</span>
                                <div class="form-content">
                                    <input type="url" id="javBusUrl" class="jhs-field">
                                </div>
                            </div>
                            <div class="jhs-setting-row">
                                <span class="setting-label">域名 - SupJav:</span>
                                <div class="form-content">
                                    <input type="url" id="supJavUrl" class="jhs-field">
                                </div>
                            </div>
                        </div></section>
                        </div>


                        <div id="filter-panel" class="content-panel ${"filter-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>屏蔽配置</h3><p>配置文本、演员和类别筛选规则。</p></header><div class="jhs-setting-group">
                            <div class="jhs-setting-row">
                                <span class="setting-label">
                                     启用划词屏蔽
                                </span>
                                <div class="jhs-inline-fields">
                                    <input type="checkbox" id="enableTitleSelectFilter" class="mini-switch">
                                </div>
                            </div>



                            <div id="reviewKeywordContainer">
                                <div class="jhs-setting-row">
                                    <span class="setting-label">评论区屏蔽词:</span>
                                    <div class="jhs-inline-fields">
                                        <input type="text" class="keyword-input jhs-field" placeholder="添加屏蔽词">
                                        <button class="jhs-btn add-tag-btn">添加</button>
                                    </div>
                                </div>
                                <div class="tag-box"> </div>
                            </div>



                            <div id="filterKeywordContainer">
                                <div class="jhs-setting-row">
                                    <span class="setting-label">视频标题屏蔽词:</span>
                                    <div class="jhs-inline-fields">
                                        <input type="text" class="keyword-input jhs-field" placeholder="添加屏蔽词">
                                        <button class="jhs-btn add-tag-btn">添加</button>
                                    </div>
                                </div>
                                <div class="tag-box"> </div>
                            </div>
                        </div></section>
                        </div>
                        <div id="cache-panel" class="content-panel ${"cache-panel" === activePanel ? "active" : ""}" role="region">
                            <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>缓存管理</h3><p>查看并清理非核心缓存数据。</p></header><div class="jhs-setting-group">
                            <h2 class="jhs-section__heading">以下操作不会影响核心数据</h2>
                            <br/>
                            <div class="jhs-cache-grid">
                                ${n}
                            </div>
                            <div id="cache-data-display" class="jhs-is-hidden">
                                <pre class="jhs-cache-preview"></pre>
                            </div>
                    </div></section>
                        </div>
                        </div>

                    <div class="jhs-setting-footer">
                        <button type="button" id="saveBtn" class="jhs-btn jhs-btn--primary">保存设置</button>
                        <button id="clean-all" class="jhs-btn jhs-btn--danger jhs-is-hidden">清理全部缓存</button>
                    </div>
                </div>
            </div>
        `;
}

/** Inject the Data Health sidebar item and panel HTML into the dialog. */
function injectHealthPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="health-panel"]').length && e.append('<button type="button" class="jhs-btn side-menu-item" data-panel="health-panel" aria-controls="health-panel">数据体检</button>');
    const t = $(".content-panel").parent();
    t.length && !$("#health-panel").length && t.append(`
            <div id="health-panel" class="content-panel">
                <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>数据体检</h3><p>检查本地数据并在备份后修复异常。</p></header>
                <div class="jhs-toolbar jhs-health-actions">
                    <button type="button" id="runHealthCheckBtn" class="jhs-btn jhs-btn--primary"><span>重新体检</span></button>
                    <button type="button" id="repairHealthBtn" class="jhs-btn jhs-btn--secondary"><span>备份并修复</span></button>
                </div>
                <div id="health-data-display" class="jhs-setting-output">点击重新体检查看结果</div>
                </section>
            </div>
        `);
}

/** Inject the Plugin Management sidebar item and panel HTML into the dialog. */
function injectPluginMgmtPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="plugin-mgmt-panel"]').length && e.append('<button type="button" class="jhs-btn side-menu-item" data-panel="plugin-mgmt-panel" aria-controls="plugin-mgmt-panel">插件管理</button>');
    const t = $(".content-panel").parent();
    if (!t.length || $("#plugin-mgmt-panel").length) return;
    const i = `<div id="plugin-mgmt-panel" class="content-panel">
        <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>插件管理</h3><p>按功能查看插件状态、耗时和错误记录。</p></header>
        <div class="jhs-setting-metrics">
            <div class="jhs-setting-metric"><strong id="pm-total">0</strong><span>总插件数</span></div>
            <div class="jhs-setting-metric"><strong id="pm-enabled">0</strong><span>已启用</span></div>
            <div class="jhs-setting-metric"><strong id="pm-disabled">0</strong><span>已禁用</span></div>
        </div>
        <p class="jhs-setting-help">禁用插件后需刷新页面生效。核心插件不可禁用。</p>
        <div id="plugin-mgmt-list"></div>
        <details class="jhs-diagnostics"><summary>诊断信息</summary><div class="jhs-diagnostics__content">
        <h3 class="jhs-setting-subheading">插件执行耗时</h3><p class="jhs-setting-help">页面加载时各插件 handle() 的执行时间。</p><div id="plugin-timing-table"></div>
        <h3 class="jhs-setting-subheading">错误日志</h3><div class="jhs-toolbar"><button type="button" id="pm-clear-log" class="jhs-btn jhs-btn--danger"><span>清空日志</span></button></div><div id="plugin-error-log" class="jhs-setting-output jhs-setting-output--compact">无错误记录</div>
        <h3 class="jhs-setting-subheading">缓存命中率</h3><div id="cache-hit-stats" class="jhs-setting-output"></div>
        </div></details></section>
    </div>`;
    t.append(i);
}

/** Inject the Snapshot sidebar item and panel HTML into the dialog. */
function injectSnapshotPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="snapshot-panel"]').length && e.append('<button type="button" class="jhs-btn side-menu-item" data-panel="snapshot-panel" aria-controls="snapshot-panel">恢复点</button>');
    const t = $(".content-panel").parent();
    if (!t.length || $("#snapshot-panel").length) return;
    const n = '<div id="snapshot-panel" class="content-panel"><section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>恢复点</h3><p>创建、下载或恢复本地数据快照。</p></header><div class="jhs-toolbar"><button type="button" id="createSnapshotBtn" class="jhs-btn jhs-btn--primary"><span>创建快照</span></button></div><p class="jhs-setting-help">快照保存当前全部数据状态，可用于恢复。最多保留 10 个，超出自动清理最旧的。</p><div id="snapshot-list"></div></section></div>';
    t.append(n);
}

/** Inject the Network/External Requests sidebar item and panel HTML into the dialog. */
function injectNetworkPanel() {
    const e = $(".side-menu-item").parent();
    e.length && !e.find('[data-panel="network-panel"]').length && e.append('<button type="button" class="jhs-btn side-menu-item" data-panel="network-panel" aria-controls="network-panel">外部请求</button>');
    const t = $(".content-panel").parent();
    if (!t.length || $("#network-panel").length) return;
    const n = `<div id="network-panel" class="content-panel">
        <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>外部请求</h3><p>配置熔断规则并查看站点健康状态。</p></header>
        <h3 class="jhs-setting-subheading">熔断器配置</h3><p class="jhs-setting-help">连续请求失败达到阈值后，自动停止对该站点的请求，避免拖慢整体体验。</p>
        <div class="jhs-setting-row"><span class="setting-label">熔断阈值(次):</span><div class="form-content"><input type="number" id="circuitBreakerThreshold" class="jhs-field" min="2" max="10"></div></div>
        <div class="jhs-setting-row"><span class="setting-label">冷却时间(秒):</span><div class="form-content"><input type="number" id="circuitBreakerCooldownSec" class="jhs-field" min="10" max="300"></div></div>
        <div class="jhs-toolbar"><button type="button" id="resetAllBreakersBtn" class="jhs-btn jhs-btn--danger"><span>重置全部熔断</span></button></div>
        <h3 class="jhs-setting-subheading">站点健康状态</h3><p class="jhs-setting-help">各外部站点的熔断状态和请求统计。</p><div id="site-health-table"></div>
        <h3 class="jhs-setting-subheading">域名使用统计</h3><p class="jhs-setting-help">脚本实际请求过的域名及次数。</p><div class="jhs-toolbar"><button type="button" id="clearDomainStatsBtn" class="jhs-btn jhs-btn--danger"><span>清空统计</span></button></div><div id="domain-stats-table"></div></section>
    </div>`;
    t.append(n);
}

function injectResourceSourcesPanel() {
    if ($("#resource-sources-panel").length) return;
    $(".content-panel").last().after(`<div id="resource-sources-panel" class="content-panel">
      <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>磁力来源</h3><p>聚合多个来源搜索磁力结果，优先级数字越小越靠前。</p></header><div id="builtin-magnet-source-list" class="jhs-resource-card-list"></div><div class="jhs-toolbar"><h4>自定义来源</h4><button type="button" id="add-custom-magnet-source" class="jhs-btn jhs-btn--primary">+ 添加来源</button></div><div id="custom-magnet-source-list" class="jhs-resource-card-list"></div></section>
      <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>磁力规则</h3><p>使用可视化规则为结果添加标签或过滤低质量内容。</p></header><div class="jhs-toolbar"><h4>标签规则</h4><button type="button" id="add-magnet-tag-rule" class="jhs-btn">+ 新建</button></div><div id="magnet-tag-rule-list" class="jhs-resource-card-list"></div><div class="jhs-toolbar"><h4>过滤规则</h4><button type="button" id="add-magnet-filter-rule" class="jhs-btn">+ 新建</button></div><div id="magnet-filter-rule-list" class="jhs-resource-card-list"></div></section>
      <section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>截图来源</h3><p>自动选择会按优先级依次尝试可用来源。</p></header><div class="jhs-setting-group"><label class="jhs-setting-row"><span>自动选择</span><input type="radio" name="screenshotMode" value="auto"></label><label class="jhs-setting-row"><span>手动选择</span><input type="radio" name="screenshotMode" value="manual"></label></div><div id="screenshot-source-list" class="jhs-resource-card-list"></div></section>
      <details class="jhs-setting-section jhs-resource-advanced"><summary>高级 · 导入 / 导出配置</summary><p class="jhs-setting-help">高级功能：错误修改可能导致自定义来源不可用，保存前会校验配置。</p><div class="jhs-toolbar"><button type="button" id="export-resource-config" class="jhs-btn">导出资源配置</button><button type="button" id="edit-resource-config" class="jhs-btn">编辑原始 JSON</button><button type="button" id="import-resource-config" class="jhs-btn jhs-btn--primary">校验并导入</button></div><textarea id="advanced-resource-json" class="jhs-textarea" rows="10" aria-label="高级资源配置 JSON"></textarea></details>
    </div>
    <div id="cloud-services-panel" class="content-panel"><section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>115</h3><p>状态：<span id="one-one-five-state" class="jhs-badge">未检测</span> <button type="button" id="check-one-one-five-login" class="jhs-btn jhs-btn--ghost">检测登录状态</button></p><small>功能开关在刷新页面后生效。</small></header><label class="jhs-setting-row"><span><strong>115 离线下载</strong><small>在磁力结果旁显示“115离线”。</small></span><input type="checkbox" id="enable115Offline" class="mini-switch"></label><label class="jhs-setting-row"><span><strong>115 文件匹配</strong><small>根据当前番号查找网盘中已存在的视频。</small></span><input type="checkbox" id="enable115Match" class="mini-switch"></label><label class="jhs-setting-row"><span>匹配并发数</span><input type="number" id="oneOneFiveConcurrency" class="jhs-field" min="1" max="10"></label><label class="jhs-setting-row"><span>匹配缓存（分钟）</span><input type="number" id="oneOneFiveCacheMinutes" class="jhs-field" min="1" max="1440"></label></section></div>
    <div id="data-tools-panel" class="content-panel"><section class="jhs-setting-section"><header class="jhs-setting-section__header"><h3>番号列表导入</h3><p>支持换行、空格、逗号分隔番号。必须先解析预览，再确认导入。</p></header><label class="jhs-setting-group"><span>番号</span><textarea id="car-number-import" class="jhs-textarea" rows="8" placeholder="ABC-001&#10;ABC-002&#10;FC2-1234567"></textarea></label><label class="jhs-setting-row"><span>导入为</span><select id="car-number-import-status" class="jhs-select-source"><option value="">请选择</option><option value="favorite">收藏</option><option value="hasDown">已下载</option><option value="hasWatch">已观看</option><option value="filter">屏蔽</option></select></label><div class="jhs-toolbar"><button type="button" id="preview-car-number-import" class="jhs-btn">解析预览</button><button type="button" id="confirm-car-number-import" class="jhs-btn jhs-btn--primary" disabled>确认导入</button></div><div id="car-number-import-preview" class="jhs-card" aria-live="polite"></div></section></div>`);
    const sidebar = $(".jhs-mobile-sidebar,.setting-sidebar").first();
    sidebar.append('<button type="button" class="jhs-btn side-menu-item" data-panel="resource-sources-panel" aria-controls="resource-sources-panel">资源来源</button><button type="button" class="jhs-btn side-menu-item" data-panel="cloud-services-panel" aria-controls="cloud-services-panel">云盘服务</button><button type="button" class="jhs-btn side-menu-item" data-panel="data-tools-panel" aria-controls="data-tools-panel">数据工具</button>');
}

/** Build the shared quick-settings content for desktop and mobile. */
function buildQuickSettingHtml() {
    const rows = [
        [ "显示全部已鉴定内容", "showAllItem", "快速显示全部已鉴定状态。" ],
        [ "鉴定后立即关闭", "needClosePage", "完成鉴定后关闭当前详情窗口。" ],
        [ "瀑布流", "autoPage", "连续加载列表；启用后普通列表只支持默认排序。" ],
        [ "标题翻译", "translateTitle", "翻译列表和详情页标题。" ],
        [ "悬浮大图", "hoverBigImg", "鼠标悬停封面时显示大图。" ],
        [ "外部站点", "enableLoadOtherSite", "在详情页提供第三方站点入口。" ],
        [ "长缩略图", "enableLoadScreenShot", "在详情页图片区加载长缩略图。" ],
        [ "高画质预览", "enableLoadPreviewVideo", "解析更高画质的预览视频。" ]
    ];
    return `
        <div class="simple-setting__panel jhs-ui">
            <div class="simple-setting__scroll jhs-scrollbar">
                <div class="simple-setting__list">
                    ${rows.map((e => `<label class="jhs-setting-row" for="${e[1]}"><span class="jhs-setting-row__copy"><span class="jhs-setting-row__label">${e[0]}</span><span class="jhs-setting-row__description">${e[2]}</span></span><span class="jhs-setting-row__control"><input type="checkbox" id="${e[1]}" class="mini-switch"></span></label>`)).join("")}
                </div>
            </div>
            <footer class="simple-setting__footer">
                <button type="button" id="moreBtn" class="jhs-btn jhs-btn--ghost">完整设置 <span aria-hidden="true">›</span></button>
            </footer>
        </div>`;
}
