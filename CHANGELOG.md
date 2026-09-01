# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [Unreleased]

## [6.5.0](../../compare/v6.4.1...v6.5.0) - 2026-09-01

### Fixed

- RC 收口修复备份与状态数据边界：WebDAV 新备份改用跨安装 portable key，凭证仍使用安装级密钥并兼容旧密文；NewVideo 手动移除改写为 `dismissed` 决策，不再污染 `car_list`，旧空墓碑仅按已提交且未撤销的移除活动证据幂等迁移；评论缺省开启，列表截图按钮与详情/FC2 自动加载恢复为独立开关；公共 HTTP 缓存增加 IndexedDB L2，清理第三方缓存时同步清除 L1/L2，冲突事务先归档 SHA-256 诊断证据再释放 journal。
- 修复全量审计确认的榜单、弹窗、并发与设置回归：Top250 在自有榜单页恢复挂载，即使宿主页面缺少“猜你喜歡/猜你喜欢”标签也会拦截原生会员榜单路由；Top250 筛选栏恢复到列表上方，封面渲染优先使用接口明确返回的 `thumb_url`，并在 `cover_url` 缺失时安全回退，同时把 API 的 `/rhe951l4q/` 代理媒体路径还原到公开 CDN，避免图片请求静默失败。新片工作区使用独立弹窗内悬停预览，表格弹窗保持尾行与分页可达；熔断改为按逻辑请求统计且忽略普通 4xx，多标签状态写入、迁移、导入和缓存更新增加互斥与失效处理。历史跨页全选、瀑布流失败收敛、延迟创建的命令栏按钮、设置子面板与关键词重试、外部请求超时和凭证编码等路径同步修复，并为关键熔断与榜单场景补充回归测试。
- 修复移动端 FAB 遮挡页面末尾交互控件、离线成功确认“已下载”后因状态刷新使触发按钮脱离 DOM、旧布尔设置不兼容、无 `window.opener`、父子 frame 脚本上下文隔离或资源子弹层所有权错误而无法关闭详情页，以及翻译结果仅使用页面内存缓存导致跨刷新重复请求、首次翻译误走高延迟 GM 传输的问题；翻译现在优先使用原生 `fetch` 并在受限环境自动回退 GM 请求。统一 JHS Layer 弹窗的语义层级，确保详情页图片查看器显示在普通弹窗之上，并让备份、导入、快照等 loading 反馈始终覆盖设置弹窗。Browser smoke 现在按平台维护 Chromium 视觉基线，并以更接近真实 Layui 的 fixture 校验尺寸与层级。
- 补齐原生翻译超时回退、聚合缓存迁移与设置页完整清理，避免受限网络长期等待和逐标题 IndexedDB 访问；离线确认后的状态写入与详情关闭分别反馈失败。外部图片及视频地址改由 DOM 属性设置，Loading 增加状态语义和减少动态效果支持，Visual gate 只运行实际维护基线的项目并在浏览器缺失时快速失败。
- 修复设置刷新与写入竞态导致内存快照回退、WebDAV 本地来源授权需重载才生效、快速切换失败覆盖最新界面状态，以及布局设置失败后仅恢复控件而未恢复实际页面布局的问题。
- 收口 6.5 冻结阶段的三个回归边界：portable 备份不再携带安装级 WebDAV 凭证，导入时保留目标安装凭证；公共缓存 prune 改为分批后台调度并阻止清除后的在途响应回填；列表状态、规则、筛选和增量卡片刷新统一进入 coalescing 调度，确保最新状态最终提交。
- 修复可选插件关闭场景的浏览器设置保存门禁仍监听旧 `settings.patch` 接口而稳定超时的问题。
- 修复 JavDB 热播页因宿主没有原生列表节点而空白的问题，补充空数据、失败重试和真实 HostAdapter 回归覆盖；列表与热播封面现在先显示轻量缩略图，进入视口且缩略图完成后才升级高清图，避免首屏同时抢占大量大图请求。详情截图改为后台加载，JavBus DMM 预览改为点击后请求，减少详情启动阶段的网络竞争。
- 修复热播与 Top250 榜单页在 6.5 路由重构后被判定为非列表页（`window.isListPage=false`），状态筛选判定与状态变更刷新监听整体失效的问题：JHS 自渲染榜单页（`handlePlayback`/`handleTop`）现在按列表页路由处理，恢复快速筛选条（全部/待鉴定/收藏/下载/已看/屏蔽项，默认沿用 `defaultQuickFilterTab` 设置），页内标记“已下载/已看”后卡片即时重筛并渲染状态徽章，筛选不再出现“全部与待鉴定无区别、已下载影片无处可寻”的回退。自渲染榜单渲染完成后广播 `list-items-added`，FC2 卡片的延迟保护与对话框导航随之挂载，修复热播/Top250 上 FC2 影片点击无反应的问题。热播/Top250 不再把列表操作按钮行注入页面 h2，改为经统一挂载通道挂进各自的自有标题/筛选容器，排序方式（默认/评价人数/时间）、开始鉴定与批量操作在两个榜单页照常可用并在渲染后自愈周期/年份工具栏；评分加载不再跳过被默认筛选隐藏的卡片，避免“已标记”影片缺少评价人数并在按评价人数排序时沉底。移动端（compact）FAB 菜单补回鉴定记录入口，修复桌面按钮被命令栏收拢后移动端无法打开鉴定记录的问题。
- 修复悬停预览图层级高于详情弹窗的问题：ImageHoverPreview 默认层级从 tooltip 档（9999999999，实际被浏览器钳制到 2147483647，高于所有 JHS 弹窗）调整为新令牌 `--jhs-z-hover-preview`（介于宿主顶栏与 modal 之间），打开 FC2 详情或影片详情弹窗的瞬间预览图不再叠在弹窗之上，弹窗打开期间悬停预览始终被弹窗覆盖；tooltip 档保留给需要覆盖弹窗的原生提示。热播页浏览器测试新增“悬停预览层级必须低于 FC2 详情对话框”的门禁断言。
- 热播浏览器测试补充“日/周/月榜周期切换”回归门禁：harness 的 rankings mock 支持按 period 返回不同片单，断言周期参数贯穿页面 URL → rankings 请求 query → 卡片渲染与激活标签，防止后续路由重构再次拍平榜单周期。
- 热播/Top250 自有榜单页的排序改为页内状态：初始固定“默认”（榜单原始顺序），不再跟随全局排序设置；页内选择“评价人数/时间”只对当前页面生效并即时重排（评分补全后按需二次排序），不写回全局 `sortMethod`，普通列表页与移动端 FAB 在自有榜单页上同步遵循页内覆盖。

### Changed

- Utils、Storage、GM HTTP 与 StateService 的 legacy 实例改由 Bootstrap Composition Root 在 Vendor/GM 运行时验证后统一创建；Feature 通过 manifest 显式声明 `SERVICE.state`，不再直接导入模块级状态单例。
- Legacy GM HTTP 的真实实现进入 strict checkJs，明确请求参数、熔断状态、Cloudflare 诊断和 Userscript 回调边界；生产源码类型覆盖率提升至 91.0%，最低覆盖门禁同步上调至 90.9%。
- StateService 的真实事务实现进入 strict checkJs，删除同名宽泛声明遮蔽，并显式约束状态字段、活动日志、新作决策、journal 恢复与撤销数据边界；生产源码类型覆盖率提升至 91.5%，最低覆盖门禁同步上调至 91.5%。
- History 真实运行时进入 strict checkJs，明确仓储记录、跨页选择、Tabulator 回调与状态编辑边界；生产源码类型覆盖率提升至 92.1%，最低覆盖门禁同步上调至 92%。
- List 快速筛选规则迁入独立 Feature owner，List 按钮、MobileBottomBar 与 Settings 表单不再依赖页面插件实现并进入 strict checkJs；生产源码类型覆盖率提升至 93.8%，最低覆盖门禁同步上调至 93.5%。
- Blacklist 真实运行时进入 strict checkJs，明确任务状态订阅、筛选记录、Tabulator 回调和跨页批量状态写入边界；生产源码类型覆盖率提升至 94.4%，最低覆盖门禁同步上调至 94%。
- TaskPlugin 与 ListPagePlugin 真实运行时进入 strict checkJs，明确调度状态/结果、配置刷新、网络分页、列表增量索引、筛选视图和媒体导航边界；生产源码类型覆盖率提升至 95.5%，RC 最低覆盖门禁上调至 95%。
- RC checkJs 剩余文件改为精确 allowlist，仅允许登记 compatibility/vendor glue、原因与清理版本；新增、移动或已消除但未移除的豁免都会失败。
- 固化 11 个 Feature 的 kind、站点、启动方式、Contribution owner 与 List/Detail/compact 验证矩阵。
- UI consistency audit 的版本契约改为校验稳定 SemVer 与 package/metadata 一致性，RC Freeze 后不再错误锁死 6.4.1。
- 声明式 DI 对未列入 manifest `requires` 的 JHS token 访问改为立即抛出 `UNDECLARED_DEPENDENCY` 并写入 Diagnostics；Integration manifest 同时强制显式声明合法的 `createHostAdapter`。
- Contribution manifest 支持显式历史插件 ID，修正 TOP250 构造器名与公开 `TOP250Plugin` ID 大小写不一致导致的 ownership 元数据偏差。
- Detail 的 legacy Contribution 改为一插件一 ID；封面状态按钮、详情状态按钮、JavDB 预览以及 JavBus 原生详情/图片/预览现在保持各自独立的旧版禁用语义。
- SubtitleCat Contribution 统一归属 `external-bridge`，并兼容开发期 `detail.subtitle`；FeatureRuntime 注册时拒绝跨 Feature 重复 Contribution owner。
- Transitional PluginManager 的不可禁用属性改由 system Feature manifest 下发，删除 Settings、Stats 与移动工具栏的名称硬编码保护名单。
- MobileBottomBar Contribution 显式依赖 ProfileService，并以 compact profile 取代 legacy User-Agent/宽度判断，触屏横屏设备可按 any-pointer 与短边规则正确激活。
- Feature/Contribution/Integration manifest schema 现在拒绝空值、重复 ID/token 和非法 host；Integration cache policy 必须精确覆盖全部 capability，Adapter 必须声明 normalized contract，JavDB 补齐四项显式 no-cache 声明。
- Browser Harness 增加 JavDB/JavBus 脱敏列表 fixture，以真实站点 origin 覆盖 List route、HostAdapter、列表运行时、移动工具入口与横向溢出。
- 新增可单测的 Bootstrap Purity 架构门禁，禁止除 Composition Root 外的生产模块在导入阶段启动 DOM、网络、Storage、监听器、Observer 或定时器；原隐藏导航样式改为 Bootstrap 注入时才读取地址。
- strict checkJs 继续覆盖自动翻页、设置样式/模板和 123AV-FC2 入口，并补齐分页空值、DOM 容器与 Integration 返回数据的显式契约。
- 截图、宿主详情工作区、兼容增强与统一离线模块进入 strict checkJs；Provider availability、宿主资源边界、Observer 和 jQuery 兼容句柄均补充显式类型，覆盖率门禁同步上调至 84%。
- FC2 详情、外部站点入口和详情操作栏进入 strict checkJs，明确宿主工作区、影片/磁力数据与遗留 Vendor 句柄边界，生产源码类型覆盖率提升至 86.4%。
- 磁力聚合中心与列表封面操作进入 strict checkJs，补齐来源、磁力结果、卡片事件和媒体句柄契约，生产源码类型覆盖率提升至 87.5%，最低覆盖门禁同步上调至 87%。
- DMM 预览、备份文件操作和设置诊断面板进入真实 strict checkJs，移除遮蔽生产实现的同名声明文件；生产源码类型覆盖率提升至 89.2%，最低覆盖门禁同步上调至 89%。
- PluginManager 与 BasePlugin 的真实运行时实现进入 strict checkJs，移除宽泛的同名声明文件，并显式约束插件注册、启动时序、错误诊断、宿主信息读取与共享图标状态；生产源码类型覆盖率提升至 89.8%。
- UI primitive 与 JhsSelect 的真实实现进入 strict checkJs，移除同名宽泛声明文件并明确动态容器、原生 Select、可访问性 Observer 和事件边界；生产源码类型覆盖率提升至 90.3%，最低覆盖门禁同步上调至 90%。
- RC 发布门禁新增 Tampermonkey 人工 Smoke 记录校验；从 6.5.0 起必须记录实际 Edge/Chrome、Tampermonkey、全部强制 Smoke 检查和精确 UserScript SHA256，缺失或产物不匹配会阻止发布。

### Fixed

- 修复可选 List/Detail Contribution 被禁用时沿 legacy 硬依赖链级联移除核心运行时、Settings 表单 hydration 失败后仍可保存、插件禁用统计计入无效旧值，以及自定义 123AV 镜像在 History 中来源误标的问题；legacy 插件边现统一为显式可选依赖，并增加声明式 Runtime Service、禁用组合和加载重试门禁。
- 修复禁用外部站点后设置弹窗初始化提前中断、内部按钮失效，以及 FC2 核心详情被可选插件同步异常阻断的问题；设置行为现先绑定并按区块降级，站点 URL 统一由 MovieIdentityService 提供，FC2 可选 Contribution 独立 fail-open。
- 插件管理目录现在保留已禁用 Contribution 的描述信息，可在设置中重新启用；legacy 依赖新增必需/可选两种读取契约，缺失必需依赖会给出明确链路并写入 Diagnostics。
- 修复 JavDB 高级搜索、想看和看过列表因 URL 白名单遗漏而未启动列表运行时的问题；HostAdapter 现在按宿主列表 DOM 能力识别路由。
- 修复 FC2 等跨路由 legacy Contribution 借用 Detail Feature scope 后在列表页被判定为不可用的问题；每个 Contribution 现拥有独立生命周期，并将 FC2 原生卡片链接保护为 JHS owned detail page。
- 修复 Settings 导航按钮委托范围不覆盖实际挂载节点、`settings.open` 依赖模拟 DOM 点击，以及禁用 CoverButton/Blacklist 后打开或保存失败的问题；入口、保存忙碌态与失败反馈现由 Settings owner 统一处理。
- 修复新旧设置写入形成双状态源的问题；设置表单、快捷开关、主题、插件管理与资源设置统一写入 SettingsService，并同步刷新 legacy 缓存与当前 Runtime snapshot。
- 恢复 123AV 自定义 HTTPS origin，搜索、详情、Cookie Partition 与 URL Policy 统一使用同一配置；搜索分页现使用已验证的 `page` 参数，旧镜像详情路径也可识别为 123AV 来源。
- 修复 FC2 搜索 URL 被误解析为 `movieId=search` 以及 JavBus History 绕过统一 FC2 工作区的问题；只有明确 `/v/<id>` 路由直接取 ID，其余均按番号解析。
- 修复 `mobileMode=on/off` 未进入 ProfileService、运行时切换不更新移动工具栏，以及移动详情状态误把 JavDB movieId 当番号的问题。
- JavDB“想看”操作在已登录时先读取账户想看列表，已存在的作品不再重复提交。
- 修复 JavBus masonry 在宿主未提供全局 border-box 时因 `width:100%` 叠加水平 padding 产生横向溢出的问题。
- 修复 ESM 单入口迁移后核心主题、宿主布局与 UI primitive 样式未进入启动链的问题；样式模块现在保持导入无副作用，并由 Bootstrap 显式一次性注入。
- 重新整理 FC2 与 123AV-FC2 详情页：影片信息、剧照、资源、评论和相关清单现在各有固定位置，关闭页面后旧请求不会再改动界面；同时补回来源链接、高清/字幕/日期标记与磁力筛选，123AV 详情也能加载对应的 JavDB 磁力。
- 修复 FC2 详情来源识别、局部重试、标题右键关闭和移动端资源显示问题；更多磁力来源现在可以收起并复用已加载结果，空截图或空外部资源也不会留下多余区域。
- FC2 详情重新提供 JavDB 账号的“想看”操作，并与 JHS 本地收藏分开；剧照放大后支持左右切换并默认居中显示。
- 修复鉴定记录表头全选只处理当前分页的问题；现在会选择当前搜索和筛选条件下的全部记录，支持跨页保留、逐项排除，并让批量提示与实际处理数量一致。
- 修复列表页“全部”仍被旧状态显示设置二次过滤的问题；收藏、已下载和已看作品会正常出现在“全部”中，硬屏蔽内容仍统一收在“屏蔽项”。
- 修复 DMM/FANZA 外部链接检测分支因缓存键变量遮蔽站点配置而触发 TDZ 异常的问题，并增加构建产物回归测试。
- 修复 JavBus 与列表封面请求 DMM 预览时未注入 MovieService 和 LifecycleScope、导致无缓存请求无法访问远端 Provider 的问题。
- 修复批量操作从第 2/3 页启动时漏掉前面页面的问题；批量扫描现在总是先解析当前搜索条件的第一页（JavDB 删除 `page` 参数，JavBus 剥离 `/page/N` 与 `/star|genre|maker|actress|series|tag/<id>/N`），当前页即第一页时复用 DOM，随后从第一页扫描到最后一页。
- 修复 Preview 关闭后异步回流：DMM 请求、卡片预览与 JavBus 预览在所有 await 边界后重新校验总开关/DMM 子开关与 generation，OFF 后在途请求不再重建播放器、工具栏或预览入口；JavDB 人工创建的预告片入口单独标记 `data-jhs-dmm-trigger`，DMM OFF 只移除该入口、不动宿主原生预览。
- 修复列表与 FC2 标题翻译在 OFF 后旧请求返回仍写回译文的问题；列表翻译新增 translationGeneration 作废机制，标题渲染统一在写 DOM 前检查 isActive。
- 修复外部站点面板在 OFF 后异步重新挂载的问题；OtherSite 新增 mountGeneration，并在 getSiteConfigs/mapLimit 等异步边界后重新校验挂载代次与 `enableLoadOtherSite` 设置，FC2 挂载同时合并 workspace 存活检查。
- mobileMode 现在统一控制桌面命令栏、桌面设置入口与移动 FAB 三套 Surface：compact 只保留 FAB，regular/wide 只保留桌面工具栏与设置入口；桌面命令栏卸载时把收拢的控件放回宿主原位，再次开启可完整重建。
- 批量交互收口：一键屏蔽只保留业务函数内的单次确认；批量写入阶段禁用取消按钮并提示“正在写入，无法取消”；批量按钮文案统一为“批量屏蔽 / 批量收藏 / 批量标记已下载”。
- 修复旧版 `.search-image` 识图入口在 SearchByImagePlugin 禁用时仍被 clone/replace、导致宿主原生按钮失效的问题；插件 OFF 时完全不碰宿主 DOM。
- 真正启用 PNG Visual Regression Release Gate：新增 `check:visual`（内部显式设置 `JHS_VISUAL_REGRESSION=1`），`check:release` 与 CI 均执行；提交 JavDB/JavBus/FC2/Settings 桌面与移动两组真实 baseline PNG，snapshot 路径不含平台后缀。
- AutoPage 在 Feature 根 scope dispose 时补 `stop()` 清理，首次启动与重复启动统一走同一 waterfallPromise 管理。
- 搜索/列表页（JavDB search、advanced_search、/tags；JavBus search、/genre、/director、/studio、/label 等）新增跨全部分页的「批量收藏 / 批量标记已下载」入口：批量逻辑改为 `batchSaveAllVideos(scope, flag)`，搜索条件批量不要求演员名、不把关键词写入 names，卡片自身有演员信息时逐条解析，并保留 FC2 来源字段。
- JavBus 分页第一页解析下沉到 `JavBusHostAdapter.resolveFirstPageUrl`（JavDB 同步下沉到 `JavDbHostAdapter`），新增 search/director/studio/label 前缀与站点/语言前缀路径测试，`batch-scope` 只保留纯 URL 比较工具。
- 修复 desktop↔compact 切换时桌面命令栏被先 remove 导致内部控件 `isConnected=false`、restore 被跳过而丢失按钮的问题；卸载现在先按逆序把控件放回原始 row/anchor（保留原 `.jhs-list-btn-row`），再移除命令栏外壳，切回桌面后按钮与事件 handler 完整保留。
- FC2 第三方站点与剧照改为稳定 Feature Slot：OFF/无结果只清空或隐藏分组，错误渲染 error-state，不再 `.remove()`；只有整个 capability 插件缺失时才允许移除分组，OFF→ON 无需刷新即可重新挂载。
- FC2 标题翻译收敛为唯一入口 `applyFc2Translation()`（native FC2、123AV 摘要、live ON 共用），增加 per-context in-flight 单飞与 generation/isActive 校验；`renderTranslatedTitle` 的 catch 分支同样检查 isActive 与节点连接，OFF 后请求成功或失败都不会再写回译文。
- Preview 增加 capability 门禁（canUsePreview / canUseNativePreview / canUseDmmPreview / canUseCardPreview）：列表卡片 `.videoSvg` 与 JavBus JHS preview 在「Preview ON + DMM OFF」时不再创建/显示 DMM-only 死按钮，并同时监听 `enablePreviewVideo` 与 `enableLoadPreviewVideo`。
- 批量任务改为模块级 Single Flight Coordinator：收藏/已下载/批量屏蔽共用同一任务锁，第二个任务不启动并提示「已有批量任务正在执行」，任务期间批量入口视觉禁用（aria-disabled + busy 样式）但仍可点击以给出明确提示；旧任务 finally 只清理自己的 run，不再误清新任务。
- Settings 桌面导航的 `loopDetector` 增加 surface generation：compact 卸载后旧 timer/DOM 等待回调不再把桌面 nav 重新 append 回来。
- OtherSite 挂载 generation 改为 per-context（WeakMap<root, number>），多个 FC2 context/dialog 并行时互不使对方失效；详情页与 `unmount()` 仍维护 document 级作废语义。
- 列表按钮行改为 flex-wrap，窄屏（mobile）下新增的批量按钮不再造成横向溢出。

## [6.4.1](../../compare/v6.4.0...v6.4.1) - 2026-08-23

### Changed

- 新作品、黑名单与收藏演员同步统一使用持久化 attempt/completed/next 调度状态机；跨标签锁负责并发互斥，五分钟租约与补偿时间负责跨页面顺序去重。
- 整批与单演员时间语义分离，设置修改会跨标签失效任务配置，并在完整任务结束时按最新检测间隔计算下一轮时间。
- 设置保存统一通过 `settings-changed` 失效任务配置；任务配置采用原子替换与串行重算，运行中的任务始终持有完整配置。
- 新作品中心改为 Storage 快照驱动的内存工作区，搜索、筛选、排序与分页不再重复读取本地存储；数据变更统一由 `new-video-changed` 合并刷新。
- 新作品封面仅按当前页并发加载并使用 generation 隔离过期结果；批量操作只取消成功项选择，失败项可继续处理。
- 黑名单筛选改为四条件组合与防抖搜索，重置只刷新一次，并保留同一个 Tabulator 实例处理空结果。
- 统一任务状态、批量栏、分段视图、Avatar 选择、移动排序、离线提交与设置页的按钮层级、键盘和 ARIA 反馈。

### Fixed

- 修复列表页切换或恢复可见时重复启动新作品检测、全员跳过无法推进整批时间，以及部分失败后成功演员被重复请求的问题。
- 修复空收藏、登录失效、挑战页、异常列表结构及演员分页循环可能被误判为成功或无限递归的问题，并为收藏分页增加同源、端点和 200 页边界。
- 修复黑名单解析与存储异常被吞掉、全部检测配置值 `0` 被默认值覆盖，以及真实最近发行日期依赖 DOM 首项或随待处理列表清空的问题。
- 修复收藏同步等普通任务失败会中断后续后台检测的问题；仅 Cloudflare 和熔断器阻断会终止本轮剩余任务。
- 黑名单自动与手动检测改为按来源 URL/当前站点显式选择 JavDB 或 JavBus 解析器，兼容 JavDB/JavBus 镜像域名，并统一整批检测与五分钟补偿提示。
- 修复收藏同步 finalize 失败时返回状态不一致，以及 pending 调度丢失 next 后可能绕过五分钟租约的问题。
- 修复跨标签无法证明任务正在运行却被显示为“运行中”、设置保存触发重复调度重算，以及任务异常退出后本标签 active 状态未可靠清理的问题。
- 修复新作品 mutation 后内存列表过期、事件与手动刷新双执行、隐藏选择继续被批量处理、旧封面请求覆盖新页面，以及关闭 Dialog 后异步回写 DOM 的问题。
- 修复黑名单写入移除新作记录后未触发工作区失效、并发配置读取可能由旧结果覆盖新设置，以及演员导入数据直接进入 HTML attribute 的问题。
- 清理黑名单分页旧提示、补齐黑名单任务状态与 Command Bar 焦点返回，并统一 Logger、MagnetHub 和编辑演员按钮样式。
## [6.4.0](../../compare/v6.3.0...v6.4.0) - 2026-08-22

### Added

- 新增四维 `stateFlags` 作品状态、版本化 data v2 迁移、保守番号规范化、迁移快照与 canonical collision/未知旧状态数据健康报告；更高版本数据在任何写入前拒绝导入或启动。
- 新增幂等 `StateService`、跨 `car_list`/活动日志/演员新作/新作决策的 write-ahead journal、崩溃恢复、30 天活动保留及逐项冲突的部分撤销。
- 新增多状态列表/详情交互、收藏未下载等智能视图、新作品中心搜索/筛选/多选决策，以及操作记录和离线历史视图。
- 新增 123/115 统一离线 Provider、授权可用性缓存、按资源能力路由的手动离线入口、不可覆盖的离线重试记录，以及 115 基于单一列表生命周期的增量可见区匹配。
- 新增基于活动事务的状态趋势与覆盖范围提示；趋势明确仅统计 6.4.0 及之后产生的操作。

### Changed

- 作品业务查询、筛选、统计与 UI 统一读取 `stateFlags`；legacy `status` 仅保留为旧接口和备份的兼容投影，主动屏蔽与关键词/演员自动过滤彻底分层。
- 多标签同步改为带 `eventId`/`originId` 的精准领域事件；DOM 节点事件仅在当前页面分发，状态变化不再依赖全页 legacy refresh。
- 任一作品状态首次设为 true 时，会事务性地从所有演员的新作列表移除并清理决策；状态恢复为 false 不会自动重新加入新作列表。
- 新作操作统一使用“从新作列表移除”文案并明确不会删除作品状态记录；新作按 canonical 番号去重并聚合演员与类别。
- 合并 CI 与 Release 流程：版本严格递增且 Node 20/22 检查全部通过后自动创建不可覆盖的标签与 GitHub Release，并保留人工故障恢复入口。
- 新增统一发布契约，校验 package、lockfile、UserScript 元数据、跟踪产物和 CHANGELOG 版本一致性；同步更新 README、贡献指南与 PR 检查清单。

### Fixed

- 修复单值状态覆盖其他状态、自动过滤误计为主动屏蔽、跨标签事件重复处理、115 动态卡片重复请求，以及先选出当前 Provider 无法提交资源的问题。
- 修复详情工作区重挂载 JavDB/JavBus 宿主动态节点、离线按钮错位或重复、磁力排序后增强失效，以及原生排序选择事件重复派发的问题。
- 修复热播与 Top250 绕开普通列表详情导航、“打开待鉴定”强制新标签、详情状态操作误关其他弹层，以及 FC2/123AV 状态只能设为 true 无法取消的问题。
- 修复两位演员共享同一新作时 Stats 重复累计待处理数量的问题。
- 修复 JavDB 详情页工作区重排宿主动态模块，恢复磁力、评论、相关清单与原生推荐的稳定顺序。
- 修复评论与相关清单跨详情实例共享加载状态的问题，并将两类面板改为并行初始化。
- 缩小详情资源 DOM 生命周期监听范围，避免评论、相关清单和其他非磁力更新触发资源重计算。
- 修复鉴定记录编辑仍使用单状态模型，以及 JavDB“看过”错误导入为“已下载”的问题。
- 清理 115/123 旧原生离线按钮注入路径，统一由 UnifiedOffline 管理。
- 修复设置值为 `false`、`0` 或空字符串时被默认值覆盖，以及离线服务选择器未持久化的问题。
- 修复多状态作品在“全部”视图被单个关闭开关错误隐藏，并让显式状态筛选不再受默认可见性开关干扰。
- 修复离线授权失败长期占用缓存、重试未优先原 Provider、多页状态导入提前完成，以及评论右键事件重复绑定的问题。
- 修复鉴定记录弹层使用全局选择器、单行状态只能置为 true、列表精准事件重复全量扫描，以及 Stats 点击重复应用筛选的问题。
- 收口列表页 hard-hidden、待鉴定和屏蔽项语义，将十个一级筛选精简为桌面 5+1 与移动端紧凑菜单，并统一所有入口通过筛选 API 切换。
- 修复 Stats 全库指标错误跳转到当前页筛选、CommandBar 菜单被横向 overflow 裁切，以及离线成功反馈结束后按钮仍显示“已提交”的状态错误。
- 移动端列表 FAB 固定为六个入口，“开始鉴定”直接调用业务 API；同时移除无消费者的当前页屏蔽计数字段和重复后台锁错误日志。
- 清理 JavDB 详情区域的宿主广告容器。

### Removed

- 移除三个失效的屏蔽显示设置、一键最佳资源、115 离线/重命名空壳插件及 123 旧提交 UI，保留统一离线的资源能力过滤。

## [6.3.0](../../compare/v6.2.1...v6.3.0) - 2026-08-22

### Changed

- 在‘设置-基础配置’中添加‘浏览后自动移除新作品标记’的开关，实现在任意界面中打开存在于新作品列表中的作品后自动将该作品从新作品列表中移除。
- 在"新作品检测-新作品列表"中添加VR类别筛选选项，该选项和“所有 无码”等在一个列表中，且仅在新作品列表中生效显示，不在演员视图中显示。实现筛选出新作品列表中作品番号含有VR的作品的功能。
- 在设置基础配置中添加’鉴定后自动关闭详情页‘的开关，打开开关鉴定后自动关闭详情页。
- 在设置基础配置中添加选项，实现配置默认显示的选项卡的功能，可自选默认显示的选项卡。
- 在‘设置-云盘服务115’中添加开关，实现开启后在点击115离线按钮后检测到115未登录时跳转115登录的功能，关闭则按现有逻辑运行。
- 在评论区磁力链接后方追加’115离线‘与’123离线‘操作选项，且二者始终固定显示在评论区域的最右侧。


### Fixed

- 修复新作品列表“未知”类别筛选失效、115 无效链接被误判为未登录，以及 123 离线错误接收 ED2K 链接的问题。
- 修复设置列表状态显示中关闭’已下载 已观看 收藏‘标签后全部选项卡内仍显示对应鉴定标签资源的问题。
- 修复移除鉴定记录后该番号鉴定标签未变更，且未移出对应已鉴定选项卡的问题。
- 修复资源鉴定后，列表页没有实时显示鉴定标签且未从待鉴定选项卡内移除该资源并同步将该资源显示在相应鉴定标签的选项卡内的问题。
- 修复打开‘115离线’后，不显示’115离线‘按钮的问题。

## [6.2.1] - 2026-08-17

### Changed
- 热播页首屏在列表状态初始化后立即结束加载，评分补全改为四路有限并发、单次缓存读写和失败隔离，仅在评价人数排序时补全后重排。
- 普通列表页改为增量处理自动翻页新增卡片，复用筛选上下文和高清图观察器，并将翻译限制为三路并发、在途去重及批量缓存写入。
- DOM 条件等待由 1–20 ms 轮询改为 MutationObserver 驱动；插件样式合并为单个节点，可访问性扫描仅处理 JHS 控件。
- 列表排序预先提取排序键，悬浮预览空闲移动不再匹配选择器，图片尺寸缓存限制为最近 128 项。

### Fixed
- 修复页面识别函数与后台任务列表标志同名，导致详情页可能启动检测任务的问题；后台检测现在仅在可见列表页运行并保留跨标签页锁。
- 修复 123 云盘、115 与 JavBus 设置入口在不适用页面持续等待不存在 DOM 的问题。
- 修复自动翻页、排序移动和状态刷新可能触发重复全量扫描、重复翻译和重复控件增强的问题。

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
