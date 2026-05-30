# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

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

### Improved
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
- 仓库地址迁移到 Yaoser-Archive，CI 自动构建发布。

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

[Unreleased]: https://github.com/Yaoser-Archive/JHS/compare/v4.5.0...HEAD
[4.5.0]: https://github.com/Yaoser-Archive/JHS/compare/v4.4.1...v4.5.0
[4.4.1]: https://github.com/Yaoser-Archive/JHS/compare/v4.4.0...v4.4.1
[4.4.0]: https://github.com/Yaoser-Archive/JHS/compare/v4.3.7...v4.4.0
[4.3.7]: https://github.com/Yaoser-Archive/JHS/compare/v4.3.3...v4.3.7
[4.3.3]: https://github.com/Yaoser-Archive/JHS/compare/v4.3.2...v4.3.3
[4.3.2]: https://github.com/Yaoser-Archive/JHS/compare/v4.3.1...v4.3.2
[4.3.1]: https://github.com/Yaoser-Archive/JHS/compare/v4.3.0...v4.3.1
[4.3.0]: https://github.com/Yaoser-Archive/JHS/compare/v4.2.0...v4.3.0
[4.2.0]: https://github.com/Yaoser-Archive/JHS/compare/v4.1.0...v4.2.0
[4.1.0]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.4...v4.1.0
[4.0.4]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.3...v4.0.4
[4.0.3]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.2...v4.0.3
[4.0.2]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.1...v4.0.2
[4.0.1]: https://github.com/Yaoser-Archive/JHS/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/Yaoser-Archive/JHS/compare/v3.8.0...v4.0.0
[3.8.0]: https://github.com/Yaoser-Archive/JHS/compare/v3.7.0...v3.8.0
[3.7.0]: https://github.com/Yaoser-Archive/JHS/releases/tag/v3.7.0
