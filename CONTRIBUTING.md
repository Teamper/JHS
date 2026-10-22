# 贡献指南

分支、构建和验收流程以 [开发与发布说明](docs/development.md) 及当前分支的 `package.json`、构建脚本和 CI 为准。

## 开发约束

- 基础测试和构建支持 Node.js 20；完整检查及浏览器项目使用 Node.js 22 或更高版本。安装依赖后从 `src/` 修改源码。
- 日常功能分支合入 `develop`；`main` 保留正式版本与发布产物。main 热修复须在 24 小时内同步到 develop。
- 保持正式 UserScript namespace、IndexedDB 数据库与现有 `jhs_*` / `jhs-*` 标识兼容；Dev 构建使用既有独立身份。
- `develop` 业务由 FeatureRuntime 管理，新增行为放入对应 Feature / Service / Integration / UI Owner，并通过 manifest 声明依赖。旧兼容查询接口不承担插件执行；不新增业务层 `getBean()` 依赖。
- 不新增不必要的 CDN 依赖，不把外部数据直接拼接到 `innerHTML` 或 jQuery `.html()`。
- 第三方页面解析变化应附固定 HTML fixture 和对应回归测试。
- 新作品状态逻辑只读取 `stateFlags`，写入统一使用 `StateService`；不得在业务模块调用 legacy 状态写入 API 或 `window.refresh()`。
- Quick Filter 业务层只使用 `blockedItems` 等 canonical key；旧 `filter` 仅允许在兼容 normalizer 和迁移测试夹具中出现。hard-hidden 是手动屏蔽与关键词/演员规则的派生 union，不写回 `stateFlags`。
- 云盘按钮与 Provider 选择统一由离线服务及其 Feature Controller 管理；`UnifiedOfflinePlugin` 名称保留为兼容查询入口。新增 Provider 必须保留 capability filtering，并为 Magnet/ED2K 路由补测试。
- 宿主专用读取和 DOM 定位由对应 HostAdapter 负责；兼容样式按站点和所有权限定，不得把宿主选择器放入 Theme，也不得用模糊选择器扩大清理范围。
- JHS 自有 UI 使用现有 `--jhs-*` 令牌、原生语义和本地 Lucide，沿用“演员/影片”文案；监听、异步提交和弹窗资源应有可释放的生命周期所有者。
- 涉及持久化结构时必须补迁移、future-version 拒绝、崩溃恢复与导入兼容测试。

## 构建与产物

- `develop` 的 `npm run build` / `npm run build:dev` 生成 `dist/dev/JHS-7.0.dev.user.js`；普通开发修改记录到 `Unreleased`，保留稳定版本元数据及正式 `JHS.user.js`。
- 开发版交付执行 `npm run build:dev:deliver`，同时生成并提交根目录 `JHS-7.0.dev.user.js`，核对它与 dist Dev 文件字节一致。普通测试构建不改写已交付快照；产物必须由构建器生成。
- `main` 默认构建生成正式产物；`develop` 的 `npm run build:release` 也会显式写入正式产物，仅用于获授权的正式发布准备。
- 正式版本变更同步 `package.json`、`package-lock.json`、`src/main.js` 和 `CHANGELOG.md`，重新生成根目录及 `dist/` 的 `JHS.user.js` 并确认字节一致。根目录正式产物受版本控制，`dist/` 不提交。

## 提交前验证

代码修改运行相关测试和 `npm run check`，提交前检查实际 diff 与 `git diff --check`。UI、生命周期和宿主适配变化补相应浏览器回归；发布前运行完整 `npm run check:release`。纯文档变更核对命令、链接和分支事实，无需重新生成产物。

`check:browser` 依次运行启动性能和功能，前项失败会阻断后项；排查时可单独运行 `npm --prefix tests/browser run test:functional`。失败、跳过、fixture 通过和登录实站验收应分别记录；视觉基线只按实际审图结果更新。

稳定版本严格递增并推送到 `main`，且依赖 CI 门禁全部通过后，才会自动创建正式标签和 GitHub Release，请勿在普通功能或文档提交中随意升版。提交、推送、PR、合并和发布按用户授权分别执行。

提交信息使用首字母大写的 `类型: 中文标题`，并在正文说明改动、原因和实际验证结果。
