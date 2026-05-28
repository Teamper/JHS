# JHS

JHS 是面向 JavDB / JavBus 等站点的油猴脚本，当前发布版为 `4.0.1`。

## 安装

- 正式版安装地址: <https://github.com/Yaoser-Archive/JHS/releases/latest/download/JHS.user.js>
- 源码地址: <https://github.com/Yaoser-Archive/JHS>

脚本的 `@updateURL` 指向 `main` 分支的 `JHS.user.js`，`@downloadURL` 指向最新 GitHub Release 附件。

## 开发构建

- 源码入口: `src/main.js`
- 构建产物: `dist/JHS.user.js`
- 发布文件: `JHS.user.js`

```bash
npm ci
npm run build
npm run check
```

`npm run build` 会从 `src/main.js` 构建 `dist/JHS.user.js`，并同步生成根目录 `JHS.user.js`。用户安装入口仍然使用根目录发布文件和 Release 附件，不需要改为安装 `src` 或 `dist`。

`npm run check` 会执行构建、源码语法检查、发布产物语法检查和回归静态门禁，覆盖插件注册顺序、用户脚本元数据、根目录/`dist` 一致性、事件总线、多站点关键插件入口、第三方请求缓存入口和稳定发布约束。

## 版本流

- `main`: 正式发布分支。推送后 GitHub Actions 会读取 `JHS.user.js` 中的 `// @version`，创建对应 `vX.Y.Z` tag，并发布 GitHub Release。
- `dev`: 预览分支。推送后只上传 `JHS-dev.user.js` artifact，不创建 tag，不创建正式 Release。

## Roadmap

- `v3.8.0`: 数据与性能收口。
- `v4.0.0-alpha.1`: 建立工程化骨架。
- `v4.0.0-alpha.2`: 拆分 core 层。
- `v4.0.0-alpha.3`: 拆分 plugin 层。
- `v4.0.0-beta.1`: 全站点回归测试。
- `v4.0.0`: 工程化稳定版。
- `v4.1.0`: 新作品中心 + 磁力评分。
- `v4.2.0`: WebDAV 差异同步 + 数据恢复。
- `v4.3.0`: 插件开关中心 + 性能诊断面板。

## 4.0.1

- 修复列表页关键词屏蔽和演员屏蔽后内容仍然显示的问题：`getStatusKey()` 缺少 keywordFilter/actorFilter 状态映射，`applyVisibility()` 未尊重 `data-hide` 属性。

## 4.0.0

- 工程化升级收口为稳定版，保持用户安装入口、更新 URL、Release 附件和根目录 `JHS.user.js` 发布形态不变。
- 确认 `src/`、`dist/JHS.user.js`、根目录 `JHS.user.js` 的构建链路稳定，后续功能开发从源码入口继续推进。
- 保持 IndexedDB 数据库名、store 名、核心存储 key、导入导出格式和历史数据读取方式不变，旧数据无需迁移。
- Release workflow 覆盖 `main` 正式发布和 `dev` 预览 artifact；正式发布继续由 `JHS.user.js` 中的 `// @version` 驱动。
- `v4.1.0` 起继续推进新作品中心、磁力评分等用户功能。

## 4.0.0-beta.1

- 进入回归测试阶段，不再做大拆分；本版只修复兼容性问题并补充回归门禁。
- 修复拆分后事件总线消息名未加引号的问题，避免 `BroadcastChannel` 初始化和多标签页刷新消息在运行时抛出 `ReferenceError`。
- 新增 `scripts/regression-check.mjs`，静态覆盖 JavDB/JavBus 列表页、详情页、演员页、123pan 授权与离线提交、新作品检测、黑名单、统计、导入导出、WebDAV、快捷键、图片查看器、第三方请求失败入口和多标签页同步。
- CI 改为运行 `npm run check`，将源码语法检查、回归门禁、发布文件一致性纳入 release workflow。
- 继续保持根目录 `JHS.user.js`、`dist/JHS.user.js` 和用户安装/更新 URL 不变。

## 4.0.0-alpha.3

- 拆出 `src/plugins/`，按 status、favorite、blacklist、new-video、one-two-three、stats、translate、avatar、external-search、backup、subtitle、image-viewer 等目录归档业务插件。
- 构建脚本按固定顺序拼接 `src/core/`、`src/plugins/` 和 `src/main.js`，保持根目录 `JHS.user.js` 与 `dist/JHS.user.js` 一致。
- `src/main.js` 保留 userscript 元数据、全局资源初始化、插件注册入口和启动逻辑，插件注册顺序与 alpha.2 保持一致。
- 新增 `scripts/check-sources.mjs`，自动对 `src/**/*.js` 和构建脚本做语法检查，避免后续新增插件文件时漏加检查命令。
- 不改功能、不改 UI、不改用户安装地址和 Release 发布文件。

## 4.0.0-alpha.2

- 拆出 `src/core/`，建立 constants、storage、storage-index、utils、http、event-bus、logger、plugin-manager 等核心层文件。
- 构建脚本按固定顺序拼接 core 层与业务入口，继续生成 `dist/JHS.user.js` 和根目录 `JHS.user.js`。
- 保留 `window.utils`、`window.storageManager`、`window.gmHttp`、`unsafeWindow.pluginManager` 等兼容入口。
- `storage-index` 承接运行时索引和低风险去重 helper，`StorageManager` 继续作为持久化真源。
- 不拆业务插件，不改变用户安装地址和 Release 发布文件。

## 4.0.0-alpha.1

- 新增 `package.json`、`package-lock.json` 和 `scripts/build.mjs`，引入 `esbuild` 构建链路。
- 新增 `src/main.js` 作为源码入口，暂不拆分任何业务逻辑。
- 新增 `dist/JHS.user.js` 构建产物，并由构建脚本同步生成根目录 `JHS.user.js`。
- CI 增加 `npm ci`、`npm run build`、构建产物一致性校验和 `dist` 语法检查。
- 保持 `@updateURL` / `@downloadURL` 指向不变，用户安装方式不变。

## 3.8.0

- 新增 `carMap`、`actressMap`、`blacklistMap`、`statusMap` 运行时索引，降低大数据量下的重复扫描。
- 新增第三方请求 TTL 缓存，覆盖评论、相关清单、影片详情、磁力搜索、外部站点检测和缩略图请求。
- 优化 123 云盘授权同步策略，由 12 秒轮询改为事件触发加 5 分钟兜底同步。
- 新增设置页数据体检面板，支持备份后修复低风险数据问题。
- 新增 GitHub Actions 元数据和 README 版本一致性校验。

## 3.7.9

- 修复 3.7.8 语法错误导致脚本无法加载的问题。

## 3.7.8

- 还原封面按钮站点链接处理方式，仅保留异常捕获，避免改为 async handler 引入潜在问题。

## 3.7.7

- 修复快捷键设置中关闭图片快捷键后，控制台切换和折叠分类快捷键也无法使用的问题。
- 修复演员收藏时名称为空不报错的问题。
- 修复多个异步点击处理器未捕获异常的问题。
- 修复 FC2 项目点击后 `$currentImage` 未清除导致快捷键可能操作到错误项目的问题。
- 修复演员页标签展开状态记忆使用过期 DOM 引用的问题。
- 修复封面按钮的外部站点链接处理未捕获异常的问题。

## 3.7.6

- 修复快速筛选"全部"按钮无法显示已标记项目的问题。

## 3.7.5

- 修复快速筛选无法显示已标记项目的问题：当设置中关闭了某类已鉴定内容的显示后，快速筛选按钮（已下载、已收藏、已观看）无法正确显示对应项目。

## 3.7.4

- 优化列表页首屏性能。

## 3.7.3

- 123 离线任务提交成功后，会自动将当前影片标记为 JHS 已下载。

## 3.7.2

- 123 云盘授权同步入口改为 `yun.123pan.com`，在云盘页面自动读取并保存 `authorToken` / `userInfo.token`。
- JavDB / JavBus 点击 `123离线` 时不再自动打开或跳转 123 云盘；缺少授权或授权过期时仅提示登录或刷新 `yun.123pan.com`。

## 3.7.1

- 123 云盘页面会定时同步 `authorToken` / `userInfo.token`，并记录 token 来源与更新时间，不输出 token 明文。
- 123 离线接口返回 `401` 或 `token is expired` 时会清空旧授权，并提示重新打开或刷新 123pan。
- 外部网站入口默认只展示搜索按钮；点击“检测外部站点”后才请求第三方站点。
- GitHub 仓库仅保留发布必要文件: `JHS.user.js`、`README.md`、`.github/workflows/release.yml`。
