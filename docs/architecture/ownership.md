# JHS 7.0 运行时与代码职责

共享业务位于 `src/core`、`src/services`、`src/integrations` 和 `src/contracts`。应用入口装配服务和平台端口，Feature 管理贡献、命令和实例生命周期，View 用宿主 DOM 或原生控件渲染。平台和应用依赖共享模块，共享模块通过契约接收存储、网络、导航和界面能力。旧插件名仅由 `runtimeLookup` 提供给外部兼容入口，内部 Feature 通过能力与命令协作。功能和路由对应 [Feature Matrix](feature-matrix.md)。

| 入口 | 装配和生命周期 | 存储及外部依赖 |
| --- | --- | --- |
| Userscript | `src/main.js` → `bootstrapJhs` → `createAppContext` | `JAV-JHS/appData`、GM 请求和加密凭证，站点 DOM 由 HostAdapter 读写 |
| Chrome / Edge 扩展 | `src/app/extension` 的 content 和工作台经类型化 RPC 调用 offscreen domain，service worker 协调网络、任务和恢复 | 扩展来源的 IndexedDB，平台网络适配器和同一套状态、同步与备份服务 |
| Expo / React Native | `apps/mobile` 经 `@jhs/core` 和 `@jhs/parsers` 复用状态、备份、同步与公开页面解析 | SQLite 原生事务、Keychain / Keystore 和原生会话，AppState 管理同步前后台 |
| Android WebView | `scripts/build-android-web.mjs` 打包 `src/app/mobile`，Capacitor 注册 `src/platform/android` 端口 | 专用 WebView 的 IndexedDB、原生 HTTPS 请求和系统文件选择；`apps/android` 为独立样片预览 |

`packages/shared-core` 导出 Expo 消费的核心实现。`packages/shared-parsers` 用可注入的 DOM 解析器共享站点解析，浏览器用宿主 DOM，Expo 用 Cheerio。共享模块不导入 Expo、Capacitor 或扩展应用入口。入口适配器负责处理会话、生命周期和系统权限。

| 职责 | 归属 |
| --- | --- |
| 依赖装配、贡献启停与命令 | `createAppContext`、`FeatureRuntime`、`CommandRegistry` |
| 番号身份、原生页面与外部协议 | `movie-identity`、HostAdapter、Integration 和 Provider |
| 作品标记、演员、黑名单、评分与崩溃恢复 | `StateService`、领域仓库与 `StorageMutationCoordinator` |
| 生命周期、请求取消、缓存与 URL 信任 | `LifecycleScope`、`HttpService`、`CacheService`、`ExternalUrlPolicy` |
| 设置、规则和备份 | `SettingsService`、`KeywordRulesService`、`PortableBackupService` |
| 连接凭证与跨站连接配置 | `CredentialService`、`WebDavSharedProfile` 和平台加密存储 |
| WebDAV 合并、同步计算和传输 | `WebDavSyncStore`、`SyncComputation`、`WebDavSyncService` |
| 宿主详情、独立详情、弹窗和浮层 | `HostedDetailSurface`、FC2 工作区、平台对话框端口、`OwnedPopover` |
| 响应式布局和诊断 | `ProfileService`、Settings Effects Feature、`DiagnosticsService` |

作品与设置写入各自由 StateService 和 SettingsService 管理。跨端存储通过 StorageService 端口，原子导入与状态修改共用业务锁。端口提供原生事务时，业务变更和相应同步回执一起提交；事务日志在启动或下一次写入前恢复。可移植备份包含业务数据及其可移植偏好，凭证由当前安装的加密存储管理。见 [存储与迁移](adr/009-storage-migration.md)、[WebDAV 同步](adr/013-webdav-sync-recovery.md) 和 [原子保存与计算](adr/014-atomic-state-and-sync-computation.md)。

跨端验证使用 `npm run check`、`npm run check:browser`、`npm run check:visual`、`npm run build:extension`、`npm run check:mobile` 和 `npm run build:android:web`。扩展重启由已安装的 Edge 或 Chrome 验证。真实设备、账号授权和外部服务各自保留验收记录。见 [开发与发布](../development.md)。
