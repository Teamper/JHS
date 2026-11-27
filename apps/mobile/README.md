# JHS Android 与 iOS 验收工程

这是 Android / iOS 原生工程的构建与验收入口。在线构建包含公开目录、作品详情、追新、片库和备份，可按需接入站点账号、云盘、媒体库与 WebDAV。用户脚本 RC 由其发布流程单独交付。

Expo SDK 57 和 React Native 0.86.3 共用一套原生页面。默认 Android 验收包的应用 ID 为 `io.github.teamper.jhs.dev.native.lab`。样片模式和在线运行各自使用独立的 SQLite 数据库。此工程的浏览器预览固定使用中性样片。另有独立的 [Android 离线预览](../android/README.md)。

## 开发与验收

在仓库根目录安装共享依赖和移动端依赖，再检查类型与 SQLite 流程。

```powershell
npm ci
npm ci --prefix apps/mobile
npm run check:mobile
```

预览使用已经安装的 Chrome 和仓库已有的 Playwright 依赖。可以通过 `JHS_CHROME_PATH` 指定 Chrome 的位置。

```powershell
npm ci --prefix tests/browser
npm --prefix apps/mobile run bundle:preview
npm --prefix apps/mobile run test:preview
```

Chrome 预览覆盖悬浮底栏、详情返回后的目录位置、备注弹层、画廊手势、追新选中态、未保存设置与 320px 窄屏。回归还检查弹层打开时隐藏撤销提示，及从隔离 IndexedDB 读取 V28 迁移数据。截图位于 `output/playwright/jhs-mobile/`。

移动端源码按 `app`、`features`、`design`、`data` 和 `platform` 组织。`app/container.ts` 装配目录与片库服务。`@jhs/core` 提供共用业务，`@jhs/fixtures` 提供双端验收和旧预览使用的样片与预告。原生依赖安装在 `apps/mobile/node_modules`。

Android 工程要求 Android SDK 36、JDK 21 和 Gradle Wrapper。样片构建时设置 `EXPO_PUBLIC_JHS_SAMPLE=1`，然后在 `apps/mobile/android` 运行 `./gradlew assembleRelease`。默认包使用模板验收签名。iOS 的 `npm --prefix apps/mobile run bundle:ios` 生成 Hermes 包，iOS 16.4+ 安装包由 macOS/Xcode 对 `ios/JHSMobile.xcodeproj` 安装 Pods 后构建并签名。

Windows 构建可将 `GRADLE_USER_HOME` 指向较短的目录，例如工作区的 `output/g57`。CMake 的 `.cxx` 缓存记录依赖绝对路径。改变路径后可重新生成对应缓存。本地 SDK 自带的旧版 Ninja 遇到 260 字符路径错误时，可使用已安装的新版 Ninja。

在 `apps/mobile/android` 可同时验证本地 Expo 模块的自动链接、Debug 与 Release 构建及会话单测。

```powershell
.\gradlew assembleRelease assembleDebug :jhs-session:testDebugUnitTest
```

## 数据与原生接口

- 页面通过工作区调用共享的 `StateService` 和 `SettingsService`。分域通知刷新相应的 TanStack Query 缓存，隐私遮罩和撤销提示按需更新。
- SQLite v2 在事务中补建 FTS5 三字索引。1–2 字搜索和缺少 FTS5 的浏览器预览使用子串检索。标记、备注和撤销按番号更新作品行，并与操作记录和同步待处理证明一起提交。备份继续按原顺序导出 `car_list`。
- 匿名目录经 `CatalogSource`、`HttpService` 和移动网络端口。支持基础 JavDB、JavBus 及 JavDB FC2 目录与详情。外部地址经过 HTTPS 校验，错误保留已读数据。
- 在线版通过 `modules/jhs-session` 访问用户明确连接的站点。Android 使用系统 WebView 的独立配置，要求 WebView 支持多配置。iOS 使用持久化 WKWebView 存储，iOS 17 及以后按站点分配配置，旧版按站点域名隔离 Cookie 读取与清除。HTTPS 白名单和响应边界同时在原生端校验。
- 登录和退出会结束对应会话的进行中请求。123 云盘授权和媒体服务器密钥保存在本机加密存储。作品回执保存在独立的本地 SQLite 文件，演员来源状态使用本地键。这些信息不进入便携备份或 WebDAV。
- 本地备份沿用桌面数据格式，支持旧版本导入、导入前恢复点和未来版本拒绝。在线构建装配现有 WebDAV 服务、同步模型和凭证服务。Android 连接复用既有包内 Keystore 数据，iOS 使用本机 Keychain。
- Android 的 JHS 原生模块用隔离的同源 WebView 读取旧 `JAV-JHS/appData`。SQLite 先校验并暂存原始业务键和同步证据，恢复旧事务后启用。系统导出选择器只持有缓存文件名，文件内容留在 App 私有缓存中。

## 原生设备验收

V28 同签名构建的入口是 `-PjhsV28Upgrade=true`，由部署侧注入 `JHS_V28_KEYSTORE`、`JHS_V28_STORE_PASSWORD`、`JHS_V28_KEY_ALIAS`、`JHS_V28_KEY_PASSWORD`。启用此入口前需完成隔离设备上的升级、退回 V28 和数据读回。当前实现含正向迁移，V28 回退包仍待补齐。

真实站点登录、原站写入、云盘提交、媒体库连接和 WebDAV 仍需使用验收账号在设备上验证。iOS 编译与签名需要 macOS 和 Xcode。云盘响应缺少可靠任务标识时，回执继续显示为待核实。

| 桌面功能 | 移动端当前入口 | 验收 |
| --- | --- | --- |
| 目录、基础搜索、详情 | 发现、作品详情 | 样片流程和解析固定响应已通过，实站待设备 |
| 四个标记、备注、批量与撤销 | 片库、作品详情、历史 | SQLite 与 Chrome 样片流程已测 |
| 追新决策、演员收藏和扫描 | 追新、演员收藏 | 样片查询、暂缓和回读通过，来源异常退避与本地持久化有回归覆盖 |
| JavDB 登录、想看、看过、个人清单 | 我的 → 账号连接、作品详情、片库多选 | 固定响应覆盖继续浏览、账号切换、幂等提交及清单回读 |
| 115 和 123 云盘登录、离线提交、任务核实 | 我的 → 云盘任务、作品详情 → 来源 | 固定响应覆盖重复提交、丢失响应、原账号核对与任务确认 |
| Emby / Jellyfin 连接 | 设置 → 媒体库联动 | 覆盖 HTTPS 与字段校验，连接配置由会话草稿统一保存 |
| 备份、恢复、同步 | 备份与恢复、多端同步 | 桌面兼容导入导出已测，移动端实站同步待验 |
| V28 升级与回退 | Android 原生迁移模块 | 合成 IndexedDB 与 SQLite 两端各已测，签名覆盖安装和回退待验 |
| 标题翻译、预告和剧照 | 设置、作品详情 | 样片通过，实站媒体联动待验 |
