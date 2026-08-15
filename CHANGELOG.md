# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

## [6.2.0] - 2026-08-12

### Added
- 新增磁力来源与截图来源注册机制，支持优先级、禁用、infohash 去重、声明式自定义源校验、标签权重和非破坏性过滤结果。
- 新增独立 115 Client 与默认关闭的离线、详情/列表匹配、播放和确认后重命名；未启用时不产生 115 请求。
- 新增资源来源设置、声明式自定义磁力源管理与连接诊断、番号列表导入、鉴定记录移除、演员状态标识和评论图片编号联动。
- 新增统一 ProviderError、网络缓存 TTL、并发限制、DMM CID 候选、高清封面、番号文本与评论图片引用解析辅助。

### Changed
- MagnetHub 改由来源注册表生成现有 U9A9、U3C3、Sukebei 标签，并统一使用分源 IndexedDB 缓存和结果去重。
- 截图获取改为 provider 顺序 fallback 和分源缓存；JavStore 保留原始候选顺序，正常无结果不再作为异常日志。
- WebDAV 文件列表在缺少 `displayname` 时回退到经过 URL 解码的 `href` 文件名。
- 资源设置拆分为资源来源、云盘服务和数据工具；磁力来源、标签规则与过滤规则改用卡片和表单弹窗管理，原始 JSON 仅保留在默认折叠的高级区域。
- 移动端工具栏作为核心交互插件，不再允许通过插件管理禁用。
- 视频播放、复制、业务日志和层叠顺序分别收口到统一安全播放、剪贴板回退、`clog` 与语义 z-index 令牌。
- JavDB 与 JavBus 预览播放器共享画质按钮和工具栏基座，播放失败由具体插件提示一次，全局捕获不再推断节点分流。
- 插件主流程统一等待异步任务，明确后台任务的错误记录边界；外部文本、HTTP(S) URL 与 BTIH 在渲染前统一转义或校验。
- Top250、热播、FC2、移动端 FAB 和状态徽章统一使用 JHS 原生控件、简体文案及键盘/ARIA 交互。

### Fixed
- 修复演员详情页排序、筛选和标签链接被错误追加“已关注/已拉黑”状态；状态现在仅显示于严格匹配的演员资料区或真实演员卡片。
- 番号列表导入改为解析预览后单独确认，避免未检查识别结果便写入状态数据。
- 修复完整设置中页面列数与宽度滑块的实时数值、布局更新和重复事件绑定，并避免拖动期间重复写入存储。
- 移动端设置统一为 FAB 打开快捷设置、再进入完整设置，避免顶栏 hover 快捷设置与完整设置同时触发。
- 移动端快捷设置改用独立 Bottom Sheet，避免 Layui 仅显示遮罩而弹层本体被站点层叠上下文遮挡。
- 修复添加磁力来源和规则时 detached 表单未被 Layui 正确承载、只显示遮罩的问题。
- 修复 JavDB 在 DMM 替代源解析前播放已失效宿主源所产生的未处理 `NotSupportedError`，并统一所有媒体播放拒绝处理。
- JavDB 预告片恢复原生源即时播放，DMM 仅作为后台高画质增强；替代源失败时自动恢复原生源，关闭高画质预览也不再禁用宿主播放。
- JavDB 原生播放不再阻塞 DMM 接管，DMM 与原生源均失败时才提示；可重试网络错误允许后续点击重新解析。
- JavDB 的 DMM MP4 改用独立播放器，不再覆盖 hls.js 管理的原生 `#preview-video` 或缓存 `blob:` 地址，消除 MediaSource 生命周期冲突。
- JavDB 独立 DMM 播放器首次默认静音、播放前可见，并在未静音自动播放被拒后静音重试，再决定是否回退原生 HLS。
- JavStore 自有 HTTP 图片地址升级为 HTTPS，消除 HTTPS 页面中的 Mixed Content 警告。
- JavStore 页面解析、历史截图缓存读取和最终图片渲染统一升级自有域名 HTTP 资源，旧缓存无需手动清理。
- 统一 JHS 自建界面的简体文案、视频状态样式和复制反馈，移除 JHS 按钮上的 Bulma 混合类。
- 修复悬浮大图引用不存在的层级令牌、关闭自动翻页后仍创建运行时对象，以及移动模式在列数和弹窗判断中不一致的问题。
- 修复外部站点设置重复监听、损坏站点配置中断插件、Top250 重复 ID、裸 Promise 与空异常处理造成的诊断缺口。
- 快捷设置 Bottom Sheet 增加焦点循环和关闭后焦点恢复，移动端 FAB 改用原生按钮并支持方向键、Home、End 与 Escape。

### Security
- 自定义磁力源仅允许声明式白名单字段和 HTTPS URL，禁止用户 JavaScript、`eval` 与 `Function`。

## [6.1.1] - 2026-08-12

### Added
- 新增集中式 hostname 站点识别、JavStore/JavDB 纯解析边界及固定 HTML fixture，覆盖候选顺序、相对 URL、合法空列表与 Cloudflare challenge。
- 新增 Bug/Feature Issue 表单、PR 模板、贡献指南和私密安全报告政策。

### Changed
- 构建改为 esbuild 单入口 IIFE bundle，关闭语法、空白和标识符压缩并保留类名；产物约束改为 Sleazy Fork 的严格小于 2 MB 可读代码门禁。
- 根目录 `JHS.user.js` 改为正式跟踪产物；CI 仅检查 `main`/PR，Release 仅由不可变 `v*` 标签触发并拒绝覆盖已有版本。
- 核心管理器、工具类和全部插件类恢复语义名称，保持插件公开名称、注册顺序、存储与 DOM 兼容标识不变。
- 截图缓存统一到 `StorageManager` 的 7 天 TTL 缓存，并在首次请求时清理旧 `jhs_screenShot` 临时缓存。

### Fixed
- 站点识别不再根据完整 URL 中宽泛的 `bus` 字符串或页面标题判断，避免查询参数和路径造成误注册。
- 修复“新作品检测”演员卡片与作品列表容器在桌面窄窗口和移动端出现无意义横向滚动及空白区域的问题，同时保留纵向滚动。
- 修复 123AV 中文版适配：更新 FC2 列表、搜索、分页和详情解析，收紧 Cloudflare 强特征判断，并仅为 123AV 请求设置 cookie partition。

## [6.1.0] - 2026-08-11

### Added
- 新增深色模式（设置 → themeMode：浅色 / 深色 / 跟随系统）。JHS 自建表面全部随主题切换，宿主站点内容保持原有主题。
- 新增全局设计令牌、原生共享组件基座、弹窗尺寸预设、详情工作区和 UI 一致性审计。

### Changed
- 详情页番号改为由 `jhsCarNum`、宿主番号节点和可靠 fallback 统一解析；列表打开详情时显式传递已知番号，DMM、JavStore 与详情操作在番号不可用时提前停止。
- 悬浮大图改为单实例委托状态机，加入延迟关闭、URL 缓存和无空窗切换；新作品解析区分合法空列表与异常页面。
- 第二轮收口全部 JHS 自有选择器：新增以隐藏原生 `select` 为值源的 `JhsSelect`，统一 popover、`menuitemradio`、禁用/显隐、optgroup、键盘与焦点返回，并同步规范输入框、顶部搜索和弹层关闭按钮。
- 新作品检测入口改为幂等自初始化并返回统一批次统计；存储队列向调用方传播失败且保持后续任务可继续，只有解析与持久化完整成功才推进演员及全局检测时间。
- 磁力过滤按分辨率、字幕和高质量信号明确分类；无匹配时保留过滤入口并提示本次未隐藏，关闭过滤会恢复全部磁力行。
- 收口 6.1.0 列表与详情 UI：删除完整帮助体系和八处问号提示，统一热播标题行、三项一级工具栏、更多菜单及原生排序 popover 的 ARIA/键盘契约。
- 重做卡片状态、第三方站点与复制菜单，统一为卡片内 152px popover；全量清退 `.menu-btn`、`.main-tab-btn` 与 `.a-*` 视觉类及重复按钮 CSS。
- 提升详情评论、相关清单和宿主操作的排版可读性；宿主操作仅在 `hideNav=1` 详情信息区按精确中文标签追加 JHS 外观类，不改变原元素、ID 或事件。
- 完成 6.1.0 UI CSS 清场：快速设置使用独立单列布局，设置中心移除旧 `.form-content *` 与多层卡片边框，插件诊断信息默认折叠，按钮、开关、滑块和反馈色统一由共享基元控制。
- 详情工作区改为文档式五区结构，评论与相关清单使用独立语义列表；折叠操作合并到唯一的 section 标题，长资源链接改为打开/复制控件。
- 构建阶段启用标识符压缩，在保留完整 UI 功能的同时继续满足 620 KiB 产物预算。
- 重建插件就绪阶段和统一列表工具栏：CommandBar 在即时插件完成后组装，加入黑名单与排序恢复常驻，批量菜单仅保留三项真实批量动作；热播榜单复用分段控件并支持等待评分后的默认、评价人数和时间排序。
- 重整设置与快速设置：移除重复框线、自动兜底说明、绿色普通开关和遗留按钮状态色；快速设置收敛为 8 个常用开关，插件管理按产品名称与功能分组展示。
- 设置模板直接输出 section/group/row 信息结构，删除运行时二次包装；全仓静态内联样式清零并改由共享布局类和插件状态类承载。
- 详情标题收敛为番号元数据、原文标题和中文翻译三级；外部站点入口改为中性按钮与轻量状态标记；新作品卡片改为自适应 260px 网格和圆形头像。
- 全仓 UI 现代化：新增原生共享组件基座，统一按钮、表单、开关、工具栏、设置分组、标签、分段控件、分页、状态页、弹层与 Tabulator 视觉；采用高密度现代桌面工具风格，不新增运行时依赖。
- 设计令牌扩展为 4/8/12/16/24/32px 间距、6/8/12/14px 圆角、36px 桌面控件与 44px 移动触控目标，并统一 120-180ms 状态过渡与减少动效行为。
- 设置中心采用 180px 圆角导航、分组内容与固定操作区，移动端切换为横向导航和单列内容；动态工具面板同步改用原生按钮与键盘可操作页签。
- 新作品卡片、磁力来源及搜索结果迁移到统一 badge、图标按钮、segmented control、列表行与加载/空/错误状态；磁力来源支持方向键、Home、End 与 ARIA 选中状态。
- 重组设置、详情、主页工具栏、新作品、鉴定记录和黑名单的信息结构，统一高密度桌面工作区布局与弹窗尺寸。
- UI 可读性与按钮对比度整改：拆分状态文字令牌（`--jhs-status-*-on` 实色底文字 / `-text` tint 底文字），彻底移除共享 `--jhs-status-text-on`，17 处引用逐处迁移；浅色 `--jhs-text-faint`、`--jhs-border-strong` 校正到 WCAG AA（文字 ≥4.5:1、UI 边界 ≥3:1）。
- 新增 `--jhs-placeholder` / `--jhs-disabled-bg|text` / `--jhs-brand-javdb|javbus` / `--jhs-code-bg|text|line` 令牌与输入框 / placeholder / disabled 全局基座（仅作用于 JHS 表面与弹层）。
- 公共按钮类（`.a-*`、`.jhs-btn--*`、`.menu-btn`、`.jhs-filter-btn`、`.jhs-nav-btn`）统一消费 `-text` / `-on` 令牌，实色按钮 hover 改用 `filter: brightness(0.94)` 并重述 `-on`；`.site-btn` 合并为单一中性基座。
- 收敛约 25 处散落硬编码 hex（搜索框、设置面板 12 个 menu-btn、统计紫色、折叠按钮、品牌色、加载占位、代码查看器、日志 tooltip / console-logger、新作品与黑名单状态色、CDN 源按钮、画质 active 按钮等）至 `var(--jhs-*)`，深色模式下全部可读，并移除多余 `!important`。

### Fixed
- 适配 JavStore `search?q=` 搜索入口及 `-pn.html` 正文结果结构，按页面原始顺序依次检查番号匹配详情，返回首个有效 `CLICK HERE!` 预览；单项 404、空内容或无预览时继续下一项。
- 恢复 `getPageInfo()` 的 `{ carNum, url, actress, actors, publishTime }` 返回契约，并增加详情页对象合同断言，避免插件共同读取到 `undefined`。
- 修复空番号触发 DMM `toLowerCase()` 异常和 JavStore `search/undefined.html`，无番号缩略图不再生成重试或确认链接。
- 修复新作品演员卡片中 JavDB 地址变量被回调局部变量遮蔽导致的 TDZ，并为构建产物增加回归门禁。
- 修复新作品检测依赖 idle 启动顺序、解析空页面误报成功、部分失败仍推进检测时间、网络阻断后统计失真，以及数据加载失败长期停留在占位状态的问题。
- 修复 FC2/JHS 详情工作区遗漏磁力过滤入口、JavBus 设置按钮闭合错误、评论正文宽度被限制、分段项未双轴居中和封面第三方导航缺少真实链接语义的问题。
- 消除 JavBus/JavDB 封面 hover 缩放、阴影和描边造成的闪跳，并保留悬浮大图生命周期与开关逻辑不变。
- 修复悬浮大图反复翻边、重复启停后监听器无法解绑、异步图片在销毁后恢复预览节点的问题，并按视口限制大图尺寸。
- 修复快速设置开关被裁切、完整设置开关被拉伸、列表状态文字竖排、插件类别闭合标签错误，以及详情工作区观察整个页面造成的重复路由和布局抖动。
- 修复 CommandBar 空筛选容器形成小点、初始化竞态、上下文操作误入批量菜单，以及热播主动移除排序和异步评分全部按 0 排序的问题。
- 修复详情翻译在番号缺失时渲染或缓存 `undefined`、重复初始化插入多条翻译，以及外部内容使用 HTML 更新的问题。
- 修复暗色模式下不可读的若干真实对比度问题：console-logger 深底深字、设置面板「使用说明」标题、磁力错误提示、状态标签实色文字等。
- 新建 `scripts/contrast-audit.mjs` 纳入 `npm run check`，对全部设计令牌做 WCAG 对比度护栏。
- 新增 UI 一致性审计，校验共享组件状态、移动触控尺寸、减少动效、键盘页签语义，并禁止斜 ribbon 与拟态渐变重新进入源码。

## [6.0.0] - 2026-08-09

### Changed
- 正式品牌统一为 `JHS`，英文全称调整为 `JAV Helper Suite`，移除旧名称中的个人维护标识。
- UserScript 作者统一为 `JHS Contributors`，简介改为面向 JavDB / JavBus 的功能定位说明。
- npm 包名调整为 `jhs-userscript`，README 同步采用新的项目名称和品牌描述。
- 项目主页、问题反馈、下载和自动更新地址统一迁移到 `Teamper/JHS`。
- 保留 `JAV-JHS`、`jhs_*` 与 `jhs-*` 等内部兼容标识，确保现有数据、设置和页面交互可以原地升级。
- 保留既有 UserScript namespace 作为兼容身份，避免升级后隔离已有 GM 存储和 123 云盘授权数据。

### Fixed
- 移除日志窗口中已经过期的 `V3.6.0` 固定版本文案。

## [5.0.2] - 2026-08-09

### Documentation
- 将 README 扩展为完整项目信息页，补充功能范围、支持站点、安装使用、数据隐私、项目架构、开发验证、发布流程和常见问题说明。

## [5.0.1] - 2026-08-09

### Fixed
- 修复 v5.0.0 网络重试检查中的变量遮蔽导致 `GM_xmlhttpRequest` 请求方法变成 `null` 的问题，恢复 123 云盘离线提交及其他 POST 请求。

## [5.0.0] - 2026-08-09

### Fixed
- 修复 Cloudflare 阻断后收藏演员分页不断猜测下一页并无限递归的问题；挑战页、熔断状态现在会立即停止重试和当前批量任务，避免错误日志与 Toast 风暴拖死页面。

### Changed
- 将新作品面板初始化和后台检查任务延后到浏览器空闲阶段，首屏插件并发完成后即可进入就绪状态。
- 插件基类的通用 SVG 改为原型共享，避免每个插件实例重复保存相同图标属性。
- 构建产物启用仅语法与空白压缩，保留标识符名称，并增加 620 KiB 体积门禁。
- 移除已失效且代码未使用的 GreasyFork `parallel_GM_xmlhttpRequest.js` 依赖。
- 移除没有配套后端实现的 `LocalPlugin`、本地端口探测及 `127.0.0.1` 权限，同时清理失去配置入口的 BTSOW 解析器和 5 个旧外部服务权限。
- 移除 16 个无内部调用的网络、存储、Cookie、分页及废弃图片源方法，并同步删除 JavBest 冗余权限。

### Performance
- 合并同一 IndexedDB 键的并发缓存读取，并通过缓存代次阻止失效前的旧读取回填。
- 将各插件 CSS 收集后一次性写入文档，减少启动阶段重复 DOM 修改和样式重计算。
- 新增 `pluginManager.getStartupReport()` 启动报告，设置页同步展示即时/空闲阶段、启动摘要和任务状态。

### Tests
- 增加启动任务调度、CSS 批量插入、共享 SVG、存储并发读取、缓存失效竞态、网络阻断快速终止、死代码及遗留服务清理测试。

## [4.9.0] - 2026-07-08

### Fixed
- 修复 advanced_search 页面（handleTop=1/handlePlayback=1）海报图片不显示：API 返回的 `cover_url` 使用多种移动端 CDN 域名（`tp.spfcas.com`、`tp-iu.cmastd.com` 等），原代码仅替换 `tp-iu.cmastd.com` → `c0.jdbstatic.com`，其他 CDN 域名未被处理导致图片在第三方 CDN 上加载失败。改为正则匹配 `/rhe951l4q` 路径前缀，统一替换为 `c0.jdbstatic.com`。

### Changed
- `hit-show.js`: `markDataListHtml` 中 `cover_url` 的 CDN 替换改为 `/https:\/\/[^/]+\/rhe951l4q/` → `c0.jdbstatic.com`
- `javdb-api.js`: `V()` 函数中 `large_url` 同上正则替换
- `list-page.js`: `_replaceSingleHdImg` 增加 CDN 域名校验（仅 `jdbstatic.com`/`javdb.com` 做 `thumbs`→`covers` 替换）+ `onerror` 回退机制

## [4.8.1] - 2026-06-30

### Fixed
- 修复 123 云盘离线提交「响应解析失败: MethodNotAllowed」错误：123 云盘 API 新增签名参数强制校验，未签名请求被 CDN 路由至 OSS 导致 POST 方法被拒。新增 `_crc32` / `_signUrl` 方法，与 Go 参考实现（OpenListTeam/OpenList）的 `signPath` 算法一致，为 `resolveMagnet` 和 `submitTask` 的请求 URL 附加 CRC32 时间戳签名。

## [4.8.0] - 2026-06-09

### Fixed
- 恢复 `@connect *` 通配符：v4.7.0 移除后导致 WebDAV 备份功能完全失效（`GM_xmlhttpRequest` 被油猴拦截，触发 onerror）。WebDAV 用户可配置任意服务器地址，无法逐个列明白名单，该通配符为必需项。

## [4.7.1] - 2026-06-02

### Fixed
- 修复新作品检测「评价人数」排序无效：`parsePage` 中 voteCount 提取选择器 `.score .count` 不匹配实际 DOM，改为从 `.score .value` 文本正则提取（与首页排序一致）。
- 修复新作品检测点击作品跳转到搜索页而非直接进入作品页：`parsePage` 新增保存作品直接 URL，渲染时优先使用。
- 修复新作品检测切换列表视图后分页按钮失效：`renderPagination` 中全局 `$(".pagination-btn").off("click")` 误删新作品列表分页事件，改为容器内 scoped 选择器。

## [4.7.0] - 2026-06-02

### Fixed
- 修复 `genericSort` 的 `nullsLast` 参数无效：comparator 对 null 值的排序逻辑错误，改为预处理分离 null 值再排序。
- 修复多处 XSS 漏洞：logger.js 内部 innerHTML 注入、fc2-by-123av.js/hit-show.js/fc2.js 远程数据未转义、storage.js 日志消息未转义。
- 修复 `importData` 缺少 schema 校验：导入文件可注入任意 key，现改为白名单校验。
- 修复 `search-by-image.js` 错别字："上传到失败" → "上传失败"。
- 修复 `main.js` 中 `processCss()`/`processPlugins()` 的 Promise 未捕获异常。
- 修复 `setting.js` 中 `applyImageMode()` 的 Promise 未捕获异常。
- 修复 CHANGELOG v4.5.2 重复段落。
- 修复 CHANGELOG v4.3.5 `### Improved` 标题不一致。

### Changed
- 移除 `@connect *` 通配符：该通配符使所有具体 `@connect` 条目无效，存在数据泄露风险。
- 补全 CHANGELOG v4.5.1-v4.6.1 的 compare links。

## [4.6.1] - 2026-06-02

### Changed
- 代码审计重构：setting.js (133KB) 拆分为 7 个独立模块（webdav-client、styles、templates、panels、forms、backup、orchestrator）。
- constants.js (32KB) 拆分为纯常量 (~100行) + css-injection.js (~300行)。
- 新增 Vitest 单元测试框架，覆盖 92 个测试用例（storage-index、utils、circuit-breaker、storage-pure）。
- 构建流水线集成测试：`npm run check` 现在先运行单元测试再构建。

## [4.6.0] - 2026-06-01

### Added
- 演员卡片头像、FC2 剧照缩略图添加 `loading="lazy"` 懒加载，减少首屏流量。
- 详情页原生磁力列表注入评分徽章（高/中/低 + 数值），基于分辨率、字幕、做种数等维度综合评分。
- FAB 菜单详情页新增状态感知：展开时读取当前番号状态，已标记的操作项显示对应颜色色块。
- FAB 菜单分组排列：状态操作、工具、设置三组，组间分隔线。
- FAB 菜单 stagger 动画：菜单项依次弹出，遮罩背景模糊效果。

### Changed
- 新作品中心移动端工具栏改为纵向堆叠，筛选下拉全宽显示，按钮自适应。
- 演员卡片网格移动端列宽从 243px 降至 150px，单行可放 2 列。
- 演员卡片头像尺寸从 100px 缩至 72px（移动端），减少占用空间。
- 分页按钮移动端增大触控区域（44px），批量操作按钮全宽显示。
- 设置面板子标签（更多工具）增大触控高度至 44px。
- 设置面板 checkbox 增大至 20px，关联文本行高 44px。
- 设置面板内容区启用平滑滚动。
- 磁力评分函数 `calcMagnetScore` 从 MagnetHubPlugin 提取为全局函数，供多处复用。

## [4.5.9] - 2026-05-31

### Fixed
- 修复移动端 toast 消息与 FAB 按钮重叠：bottom 从 80px 调整为 100px。
- 修正移动端 CSS 注释：底部栏 → FAB 浮动菜单。

## [4.5.8] - 2026-05-31

### Changed
- 移动端底部固定栏(bottom bar)替换为 FAB 浮动操作按钮：右下角圆形按钮，点击展开菜单。
- FAB 菜单包含排序方式切换（列表页）、所有详情页操作按钮。
- 移动端弹窗高度从 100% 改为 90%，底部内容不再被裁剪。
- 移除全部 UI 中的 emoji 字符，统一改为纯文本。

### Fixed
- 修复移动端排序控件（按评价人数/时间）不可见的问题。
- 修复触控反馈选择器 `a[class]:active` 过于宽泛影响普通链接的问题。

## [4.5.7] - 2026-05-30

### Fixed
- 修复移动端页面可左右滑动露出空白：html/body 添加 `overflow-x: hidden`。
- 修复用户自定义容器宽度(containerWidth)超过100%时移动端页面溢出，强制限制为100%。
- 修复演员信息面板固定宽度 span(300px+200px+200px=700px)在移动端溢出，改为响应式 flex 布局。

## [4.5.6] - 2026-05-30

### Fixed
- 修复 local.js 归档弹窗和字幕检测弹窗硬编码 area 未适配移动端，改为 `getResponsiveArea()`。
- 修复 detail-page-button.js 字幕预览弹窗硬编码 area 未适配移动端。
- 修复 fc2-by-123av.js 使用 `getDefaultArea()` 在移动端不是全屏，改为 `getResponsiveArea()`。
- 修复 `utils.q()` 确认弹窗在移动端使用鼠标坐标定位可能偏移出屏幕，改为居中显示。
- 修复弹窗标题栏未适配 iPhone 刘海/Dynamic Island，添加 `safe-area-inset-top`。
- 修复 toast 提示可能被底部栏遮挡，定位改为考虑 safe-area。
- 修复 `a[class]` 选择器过于宽泛导致内联链接被强制 44px 高度。
- Tabulator 表格移动端最小宽度从 600px 降至 400px，减少不必要的横向滚动。

## [4.5.5] - 2026-05-30

### Changed
- 移动端详情页隐藏内联按钮行，底部栏已覆盖全部操作，释放屏幕空间。
- 移动端列表页隐藏与底部栏重复的按钮（待鉴定、新作品检测、演员黑名单），仅保留页面专属批量操作。
- WebDAV 备份列表移动端改用卡片布局，每个备份文件显示为独立卡片，操作按钮全宽 44px 触控目标。
- 设置面板高级工具（数据体检、插件管理、恢复点、外部请求）合并为单个"更多工具"标签页，减少标签栏溢出。
- 缓存面板按钮改为纵向堆叠，备份面板按钮并排显示，改善移动端触控体验。

## [4.5.4] - 2026-05-30

### Fixed
- 修复 5 处弹窗硬编码像素尺寸未适配移动端：查看备份、导入预览、CDN 源选择、TOP250、历史记录编辑全部改为 `getResponsiveArea`。

## [4.5.3] - 2026-05-30

### Fixed
- 修复新作品网格移动端布局未生效：`nv-grid` 缺少 `jhs-new-video-grid` class。
- 修复设置面板内容区 `overflow: hidden` 裁切下拉框，改为 `overflow-y: auto`。
- 修复底栏 body padding 未考虑 `safe-area-inset-bottom`，iPhone 刘海屏内容被遮挡。
- 修复底栏与遮罩 z-index 相同（均 10000），底栏提升至 10002 确保层级明确。
- 修复统计弹窗 NewVideoPlugin 被禁用时的空指针崩溃。

## [4.5.2] - 2026-05-30

### Removed
- 移除快捷键功能：HotkeyManager 类、设置面板快捷键配置页、详情页/列表页快捷键绑定、预览视频快捷键标签、JavTrailers iframe 快捷键注册。

### Fixed
- 修复统计弹窗无法打开：`openDialog()` 局部变量 `d/h/g` 与全局常量 TDZ 冲突，重命名为 `barPct/barRow/dialogHtml`。
- 修复设计令牌仅在移动端可用：将 `:root` CSS 变量从 `@media` 内提升到全局。
- 修复弹窗移动端无圆角：改为顶部 12px 圆角，保留全屏感。
- 修复列表页按钮触控高度不足：`min-height` 从 32px 提升到 36px。

### Changed
- 桌面端按钮增加 `:active` 按压反馈和 `:focus-visible` 键盘导航轮廓。
- 桌面端设置面板间距加大（`margin-bottom` 3px→6px）、表单宽度放宽（160px→200px）、文本左对齐。
- 设置面板底部操作栏改为 flexbox 布局。
- Toast 默认显示时长从 1 秒延长到 2.5 秒。

## [4.5.1] - 2026-05-30

### Fixed
- 修复设置面板桌面端布局错误：侧栏和内容区方向判断三元表达式写反，导致桌面端菜单在上、内容在下。

### Changed
- 移动端 UI 全面精细化打磨：引入 CSS 自定义属性设计系统（间距/颜色/圆角/阴影/字体）。
- 底栏毛玻璃效果 + 抽屉滑入动画 + 背景遮罩，按钮触控反馈优化。
- 详情页按钮移动端改为 2×2 网格布局 + 副操作水平滚动胶囊。
- 列表页按钮移动端改为水平滚动胶囊样式。
- 设置面板标签栏、表单元素、底部操作栏、缓存网格全面优化。
- 弹窗标题栏/关闭按钮/内容区/按钮栏移动端样式打磨。
- 全局表单元素统一（防 iOS 缩放 16px、focus 光晕、统一样式）。

## [4.5.0] - 2026-05-30

### Added
- 移动端基础适配：`mobileMode` 全局标志，支持 `auto`/`on`/`off` 三种模式（自动检测/强制开启/强制关闭）。
- 底部操作栏：移动端注入固定底部操作栏，收编桌面端浮动菜单的核心功能（待鉴定、新作品、黑名单、设置、详情页快捷操作）。
- 全局移动端 CSS：通过 `@media (max-width: 768px)` 注入响应式样式，覆盖触控目标放大、弹窗全屏、表格横向滚动等。
- 移动端插件降级钩子：BasePlugin 新增 `shouldSkipOnMobile()` 方法，PluginManager 在移动端自动跳过标记的插件。
- StorageManager 新增 `getSettingSync()` 同步读取缓存中的设置值。

### Changed
- `utils.getResponsiveArea()` 移动端返回 `["100%", "100%"]` 全屏尺寸。
- `utils.isMobileMode()` 综合判断 UA + 屏幕宽度 + 用户设置。
- 设置面板移动端适配：侧栏改为顶部横向滚动标签栏，设置项纵向堆叠，移除 `min-width` 限制。
- 详情页按钮行添加 `jhs-detail-btn-row` 类，移动端纵向堆叠全宽显示。
- ImageHoverPreview 在移动端自动跳过初始化（hover 无意义）。
- Tabulator 表格移动端启用水平滚动，设置面板内原生表格同样支持横滚。

## [4.4.1] - 2026-05-30

### Fixed
- 修复磁力搜索结果标题未转义导致的存储型 XSS 漏洞（Critical）。
- 修复熔断器 half-open 状态下并发请求竞态条件：限制只放行一个探针请求。
- 修复熔断器配置被设置面板动态覆盖的问题：只在创建时应用配置。
- 修复设置面板"查看"按钮对熔断状态和域名统计缓存无效的问题。
- 修复本地服务 ping 逻辑重复实现，统一使用 utils.pingLocalService()。
- 修复 retry 函数对对象类型 reject 处理不一致的问题。
- 修复 saveForm 中 httpTimeout/httpRetryCount/circuitBreakerThreshold 未做 Number 转换。
- 修复 other-site.js 访问 gmHttp 私有方法，新增公开方法 isDomainCircuitBroken()。
- 修复 TOKEN_EXPIRED 错误处理增加对 Error 对象的支持。
- 修复 window.refresh() 可能未定义的边界条件。
- 修复 filePath 参数添加基本路径遍历防护。
- 优化 retry 函数增加指数退避（500ms × 重试次数）。
- 优化 gmRequest 设置读取改为 Promise.all 并行读取。
- 移除磁力搜索的 sessionStorage 双重缓存层。
- 重构 calcMagnetScore 避免重复计算各维度分数。
- 提取 offline.js 的 1800ms 魔法数字为 BUTTON_COOLDOWN_MS 常量。

## [4.4.0] - 2026-05-30

### Added
- 外部站点熔断器：连续失败 3 次自动熔断 60 秒，避免移动网络下反复请求不可用站点。可在设置中调整阈值和冷却时间。
- 域名使用统计：自动记录每个外部域名的请求次数和错误次数，在"外部请求"设置面板中展示。
- 本地服务 ping 缓存：sessionStorage 缓存本地服务连通状态（默认 30 秒），减少重复探测。
- "外部请求"设置面板：展示站点健康状态、域名统计、熔断配置、缓存清理入口。

### Changed
- 磁力搜索（MagnetHubPlugin）的请求统一走 gmHttp，接入熔断和统计。
- 123 云盘（OneTwoThreeOfflinePlugin）的请求统一走 gmHttp，接入熔断和统计。
- gmRequest 非 2xx 错误附加 HTTP status 属性，便于调用方区分错误类型。
- 外部站点检测（OtherSitePlugin）在请求前检查熔断状态，已熔断站点直接跳过并显示提示。
- 本地服务（LocalPlugin）ping 结果增加 sessionStorage 缓存，30 秒内不重复请求。

## [4.3.7] - 2026-05-29

### Fixed
- 排序改为按评价人数（而非评分星级），卡片显示"XX人评价"徽章。

## [4.3.6] - 2026-05-29

### Fixed
- 修复新作品列表分页控件不可见/不可用的问题：分页按钮移入滚动容器内部。
- 新增按评价人数排序：从 JavDB 演员页面抓取评价人数数据。
- 卡片封面右上角显示评价人数徽章。

## [4.3.5] - 2026-05-29

### Changed
- 新作品列表封面加大（minmax 240px），卡片增加 hover 浮动效果。
- 封面图支持 hover 放大预览（复用 ImageHoverPreview）。
- 新作品列表改为分页显示（每页 60 个），解决大量数据卡顿问题。
- 修复列表视图无法滚动的问题（overflow-y: auto）。
- 新增列表视图排序：按发行时间、演员名、番号排序。

## [4.3.4] - 2026-05-29

### Fixed
- 修复新作品封面永远加载不出来：将 coverUrl 转为绝对 URL（解决相对路径无法加载的问题），并修复异步封面获取时无法创建 `<img>` 元素的 bug。

## [4.3.3] - 2026-05-29

### Fixed
- 修复新作品列表白屏：封面获取改为非阻塞，先渲染列表再异步加载封面。
- 加载失败时显示错误信息而非空白页。

## [4.3.2] - 2026-05-29

### Fixed
- 新作品封面获取：实时抓取演员页面提取封面图和标题，解决旧数据无封面的问题。
- 新作品网格布局改为 CSS Grid 响应式（repeat(auto-fill, minmax(160px, 1fr))），与首页风格一致。

## [4.3.1] - 2026-05-29

### Fixed
- 修复新作品列表视图：改为封面图卡片网格布局，按作品日期排序（非发现时间）。
- 升级 newVideoList 数据结构为对象数组（含 coverUrl/title/publishTime），向后兼容旧格式。
- 磁力评分：修复 seeders 提取和评分显示，结果默认按评分降序排列。

## [4.3.0] - 2026-05-29

### Added
- 新作品封面网格：NewVideoPlugin 对话框新增「📋 新作品列表」视图切换按钮，以封面图卡片网格平铺展示所有待鉴定番号（按作品日期倒序），底部汇总统计和批量标记已看/已下载。
- 磁力评分：MagnetHubPlugin 每条搜索结果新增综合评分（0-100），5 维度加权：做种人数 35%、分辨率 25%、字幕标记 20%、新鲜度 15%、内容完整性 5%。结果默认按评分降序排列，评分徽章（🟢80+ 🟡60-79 🔴<60），hover 显示各维度得分详情。
- 磁力解析增强：parseTorrentList 额外提取 seeders/leechers 列。

### Changed
- newVideoList 数据结构从纯字符串数组升级为对象数组（含 carNum/coverUrl/title/publishTime），向后兼容旧格式。
- 新作品列表视图的演员类别过滤（所有/无码/有码）同时作用于演员视图和列表视图。

## [4.2.0] - 2026-05-29

### Added
- 快照管理：StorageManager 新增快照系统，支持创建/列表/恢复/删除快照，最多保留 10 个，FIFO 自动清理。
- 差异对比引擎：新增 diffData 方法，支持 array 类型 store（按主键条目级 diff）和 object 类型 store（key-value 级 diff），返回结构化差异报告。
- 冲突预览对话框：导入数据（本地文件/WebDAV）前展示差异预览面板，包含汇总统计卡片和各数据源详细差异表格，确认前自动创建快照备份。
- 恢复点面板：设置面板新增"📸 恢复点"页面，展示快照列表（名称、来源、时间、数据量），支持恢复、下载、删除操作。

### Changed
- 本地文件导入流程改造：从简单 confirm 对话框升级为差异预览 → 确认导入流程。
- WebDAV 恢复流程改造：从直接导入升级为解密 → 差异预览 → 确认导入流程。

## [4.1.0] - 2026-05-29

### Added
- 插件开关：设置面板新增"插件管理"页面，支持按分类启用/禁用单个插件，核心插件（SettingPlugin、StatsPlugin）不可禁用。
- 插件执行耗时统计：自动采集每个插件 handle() 的执行时间，在插件管理面板中按耗时降序展示，高亮超过 500ms 的慢插件。
- 插件错误日志：PluginManager 内存收集最近 200 条插件错误（含时间、插件名、阶段、堆栈），支持清空。
- 缓存命中率：cachedRequest 新增命中/未命中运行时计数器，在插件管理面板展示命中率。

### Changed
- PluginManager 的 processCss/processPlugins 在执行阶段跳过被禁用插件（而非注册阶段），确保 getBean() 跨插件引用不崩溃。

## [4.0.4] - 2026-05-28

### Fixed
- 修复快速筛选"已下载"/"全部"无法显示已标记项目的问题（回归 v3.7.5）：`applyVisibility` 中 `data-hide` 检查与筛选按钮语义冲突，快速筛选应覆盖设置项的隐藏逻辑。

## [4.0.3] - 2026-05-28

### Fixed
- 修复插件失败时错误报告本身崩溃的问题：`processCss`/`processPlugins` 中 `Promise.allSettled` rejected 结果误用 `.value` 而非 `.reason`。
- 修复 `importData` 先清库再写入导致写入失败时数据丢失：改为先写入新数据再清除旧 key。
- 修复 `showCarNumBox` 比较 `data-hide` 值错误（`"${e}-hide"` vs `"yes"`），导致历史记录删除后无法恢复列表项显示。
- 修复插件重复注册错误信息引用 `window.name` 而非实际插件名。
- 修复 `postForm` 未对表单值进行 URL 编码，含特殊字符的值会导致请求体损坏。
- 修复 `saveSettingItem` 读-改-写竞态条件：添加 `navigator.locks` 写入锁。
- 修复 123 云盘 Cookie 解析截断含 `=` 的 base64 token。
- 修复 123 离线从列表页提交时 `names` 为 undefined。
- 修复本地导入文件选择 input 过早移除（1 秒定时器 → 在回调中清理）。
- 修复新作品抓取单页失败后静默中止后续所有页：改为跳过失败页继续。
- 修正 README 中功能范围数量（16 → 20）。

## [4.0.2] - 2026-05-28

### Changed
- 扩大回归门禁覆盖范围：新增快速筛选、标记状态与隐藏、设置页、演员信息解析 4 个功能范围。
- 补充关键函数签名断言（applyVisibility、filterMovieList、getStatusKey、doFilter）。
- 更新 Roadmap，明确后续版本规划。

## [4.0.1] - 2026-05-28

### Fixed
- 修复列表页关键词屏蔽和演员屏蔽后内容仍然显示的问题：`getStatusKey()` 缺少 keywordFilter/actorFilter 状态映射，`applyVisibility()` 未尊重 `data-hide` 属性。

## [4.0.0] - 2026-05-28

### Changed
- 从单文件（~640KB / 8529 行）重构为模块化工程（50 个源文件）。
- 拆分为 `src/core/`（9 模块）+ `src/plugins/`（39 插件 / 12 目录）+ `src/main.js`（入口）。
- 构建产物仍然是单个 `JHS.user.js`，对终端用户透明。
- 新增 CI/CD：版本一致性、产物字节一致性、回归门禁（39 插件、16 功能范围）。
- 新增统计仪表盘、数据体检、第三方 TTL 缓存、数据版本化迁移。
- 启用模块化仓库和 CI 自动构建发布。

### Removed
- 移除阿里云盘备份（被 WebDAV 替代）。
- 移除 115 网盘相关功能（离线下载、文件匹配、扫码登录，被 123 云盘替代）。

## [3.8.0] - 2026-05-28

### Added
- 运行时索引（carMap、actressMap、blacklistMap、statusMap），降低大数据量重复扫描。
- 第三方请求 TTL 缓存，覆盖评论、相关清单、影片详情、磁力搜索等。
- 设置页数据体检面板。
- GitHub Actions 元数据和 README 版本一致性校验。

## [3.7.0] - 2026-05-17

### Added
- 123 云盘离线导入。
- 收藏统计仪表盘。
- 列表页快速筛选。
- 演员页批量收藏/标记已下载。

### Fixed
- 修复 3.7.5 ~ 3.7.9 多项交互逻辑和语法错误。

### Security
- 增加 `escapeHtml()` 修复多处 XSS 风险。
- 加密存储敏感凭据。

[Unreleased]: ../../compare/v6.2.0...HEAD
[6.2.0]: ../../compare/v6.1.1...v6.2.0
[6.1.1]: ../../compare/v6.1.0...v6.1.1
[6.1.0]: ../../compare/v6.0.0...v6.1.0
[6.0.0]: ../../compare/v5.0.2...v6.0.0
[5.0.2]: ../../compare/v5.0.1...v5.0.2
[5.0.1]: ../../compare/v5.0.0...v5.0.1
[5.0.0]: ../../compare/v4.9.0...v5.0.0
[4.9.0]: ../../compare/v4.8.1...v4.9.0
[4.8.1]: ../../compare/v4.8.0...v4.8.1
[4.8.0]: ../../compare/v4.7.2...v4.8.0
[4.7.1]: ../../compare/v4.7.0...v4.7.1
[4.7.0]: ../../compare/v4.6.1...v4.7.0
[4.6.1]: ../../compare/v4.6.0...v4.6.1
[4.6.0]: ../../compare/v4.5.9...v4.6.0
[4.5.9]: ../../compare/v4.5.8...v4.5.9
[4.5.8]: ../../compare/v4.5.7...v4.5.8
[4.5.7]: ../../compare/v4.5.6...v4.5.7
[4.5.6]: ../../compare/v4.5.5...v4.5.6
[4.5.5]: ../../compare/v4.5.4...v4.5.5
[4.5.4]: ../../compare/v4.5.3...v4.5.4
[4.5.3]: ../../compare/v4.5.2...v4.5.3
[4.5.2]: ../../compare/v4.5.1...v4.5.2
[4.5.1]: ../../compare/v4.5.0...v4.5.1
[4.5.0]: ../../compare/v4.4.1...v4.5.0
[4.4.1]: ../../compare/v4.4.0...v4.4.1
[4.4.0]: ../../compare/v4.3.7...v4.4.0
[4.3.7]: ../../compare/v4.3.3...v4.3.7
[4.3.3]: ../../compare/v4.3.2...v4.3.3
[4.3.2]: ../../compare/v4.3.1...v4.3.2
[4.3.1]: ../../compare/v4.3.0...v4.3.1
[4.3.0]: ../../compare/v4.2.0...v4.3.0
[4.2.0]: ../../compare/v4.1.0...v4.2.0
[4.1.0]: ../../compare/v4.0.4...v4.1.0
[4.0.4]: ../../compare/v4.0.3...v4.0.4
[4.0.3]: ../../compare/v4.0.2...v4.0.3
[4.0.2]: ../../compare/v4.0.1...v4.0.2
[4.0.1]: ../../compare/v4.0.0...v4.0.1
[4.0.0]: ../../compare/v3.8.0...v4.0.0
[3.8.0]: ../../compare/v3.7.0...v3.8.0
[3.7.0]: ../../releases/tag/v3.7.0
