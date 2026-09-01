# JHS 7.0 Feature Matrix

本矩阵是 7.0 Stabilization / Parity Freeze 的架构契约。每一行描述一个 Feature 的完整运行边界；独立启停、故障和诊断单位以 Contribution ID 为准。内容必须与 `src/features/**/manifest.js`、`src/features/system/catalog.js` 和 `FeatureRuntime` 保持一致。

| Feature | Contribution | Site | Route | Startup | Failure policy | Owner | Entry trigger | Disable semantics | User-visible surface | Automated proof | Manual proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `settings` | `settings.core` | all | all | eager | degraded | `system/catalog.js` → `SettingsCoreController` | app bootstrap | system Feature 不可禁用；Contribution 状态由 runtime 管理 | 设置面板、备份、来源和诊断入口 | `tests/architecture-runtime.test.js`; `npm run check` | Tampermonkey：打开设置并验证读写、备份入口 |
| `diagnostics` | — | all | all | eager | degraded | `system/catalog.js` → diagnostics command | app bootstrap | system Feature 不可禁用 | `diagnostics.export` 命令 | `tests/architecture-runtime.test.js`, `tests/feature-failure-isolation.test.js`; `npm run check` | Tampermonkey：导出诊断快照并检查 contribution 状态 |
| `responsive-shell` | `responsive-shell.bottom-bar` | all | all | eager | degraded | `system/catalog.js` → `ResponsiveShellBottomBarController` | app bootstrap | system Feature 不可禁用 | 响应式底栏、移动端导航 | `npm run check`，UI consistency audit | Tampermonkey：窄屏和横屏真实视口 |
| `stats` | `stats.dashboard` | JavDB, JavBus | all | idle | degraded | `features/stats/manifest.js` → `StatsController` | browser idle callback | system Feature 不可禁用 | 统计仪表盘 | `tests/stats-metrics.test.js`; `npm run check` | Tampermonkey：打开统计面板并验证数据展示 |
| `detail` | `detail.javdb-native`; `detail.javbus-native`; `detail.workspace`; `detail.fc2-owned`; `detail.page-state-actions`; `detail.javdb-preview`; `detail.javbus-preview`; `detail.reviews`; `detail.related`; `detail.native-magnets`; `detail.external-magnets`; `detail.screenshot`; `detail.external-sites` | JavDB, JavBus | detail, owned-detail | eager | degraded | `features/detail/manifest.js` → `DetailController` 与 detail controllers | detail route activation | 可禁用 Feature 或单个 Contribution；未执行为 `skipped`，异常为 `degraded` | 原生详情、FC2 owned workspace、磁力、截图、评论和相关内容 | `tests/feature-controller-runtime.test.js`, `tests/fc2-owned-workspace.test.js`; `npm run check` | Tampermonkey：JavDB/JavBus 详情与 FC2 owned-detail |
| `list` | `list.core`; `list.auto-page`; `list.fold-category`; `list.actions`; `list.fc2-navigation`; `list.cover-state-actions`; `list.javbus-images`; `list.fc2-lookup` | JavDB, JavBus | list, other | eager | degraded | `features/list/manifest.js` → `ListController` | list route activation | 可禁用 Feature 或单个 Contribution；List 不直接导入 Detail，查询能力由 service 注入 | 列表筛选、自动翻页、FC2 导航、封面状态操作 | `tests/list-visibility.test.js`, `tests/hit-show-quick-filter.test.js`, `tests/fc2-owned-workspace.test.js`; `npm run check` | Tampermonkey：JavDB/JavBus 列表、热播和 FC2 导航 |
| `library` | `library.history`; `library.keyword-filter`; `library.state-actions`; `library.blacklist`; `library.favorite-actresses` | JavDB, JavBus | list, detail, other | eager | degraded | `features/library/manifest.js` → `LibraryController` | app bootstrap 后按 route 初始化 | 可禁用 Feature 或单个 Contribution | 历史、黑名单、状态操作和演员收藏 | `npm run check`，library regression suites | Tampermonkey：列表与详情的历史、筛选和黑名单流程 |
| `identity` | `identity.javdb-navigation`; `identity.javbus-navigation`; `identity.image-search`; `identity.actress-info` | JavDB, JavBus | all | eager | degraded | `features/identity/manifest.js` → `IdentityController` | app bootstrap 后按 host 初始化 | 可禁用 Feature 或单个 Contribution；按 host 不适用时为 `skipped` | 演员导航、以图识别和演员信息 | `npm run check`，identity regression suites | Tampermonkey：JavDB/JavBus 演员页和图片搜索 |
| `external-bridge` | `external-bridge.translation`; `external-bridge.115-match`; `external-bridge.offline`; `external-bridge.123pan`; `external-bridge.javtrailers`; `external-bridge.subtitle` | JavDB, JavBus, 123Pan, JavTrailers, SubtitleCat | all | eager | degraded | `features/external-bridge/manifest.js` → `ExternalBridgeController` | app bootstrap 后按 host 和 route 初始化 | 可禁用 Feature 或单个 Contribution；未支持 host 为 `skipped` | 翻译、115、123 云盘、离线、JavTrailers 和字幕入口 | `npm run check`，external bridge regression suites | Tampermonkey：各支持站点的入口和失败提示 |
| `discovery` | `discovery.hit-show`; `discovery.top250`; `discovery.new-video`; `discovery.scheduler` | JavDB, JavBus | all | eager | degraded | `features/discovery/manifest.js` → `DiscoveryController` | app bootstrap，重任务在 idle callback | 可禁用 Feature 或单个 Contribution；站点不适用时为 `skipped` | 热播、Top250、新作和后台任务 | `tests/task-scheduler.test.js`, `tests/hit-show-quick-filter.test.js`; `npm run check` | Tampermonkey：热播、Top250 和新作任务入口 |
| `compatibility` | `compatibility.enhancements` | JavDB, JavBus | all | eager | degraded | `features/compatibility/manifest.js` → `CompatibilityController` | app bootstrap 后按站点初始化 | 可禁用 Feature 或 Contribution；异常为 `degraded` | 站点兼容增强 | `npm run check`，regression gate | Tampermonkey：JavDB/JavBus 兼容增强路径 |

## Contribution lifecycle

`FeatureRuntime.runContribution()` 是唯一的生命周期入口：`inactive → starting → active` 表示实际执行成功；执行异常为 `degraded`；配置关闭为 `disabled`；当前 route 或 host 不适用、或 Feature 启动后没有执行该 Contribution 为 `skipped`。诊断快照同时保留 `contributionStates` 和由其派生的 `activeContributions`。

## Runtime and storage freeze

v7 运行时退役门禁已经封存为以下精确约束：legacy registry entries、BasePlugin subclasses、optional dependency callsites、legacy contribution resolver callsites、legacy dependency edges 和 unsafe window exports 均为 `0`；指定的旧 runtime 文件必须不存在，唯一保留的兼容数据源是 `src/core/legacy-plugin-contributions.js`。

Parity Freeze 阶段不修改 IndexedDB identity、`car_list` 格式、journal schema、import/export 格式或 migration version。版本仍保持当前 `6.5.0`，本矩阵不代表发布版本升级；人工结果只能记录在对应版本的 `docs/release/manual-smoke-v<version>.json`，不得用未执行的手工记录替代验证。

## Route proof boundary

自动化测试和 fixture 证明代码契约与脱敏页面结构；它们不替代 Tampermonkey 实站验证。每个 Manual proof 栏仅定义应执行的验证范围，不声称本地已经完成该实站验证。
