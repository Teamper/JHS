# 贡献指南

## 开发约束

- 使用 Node.js 20 或更高版本，安装依赖后从 `src/` 修改源码。
- 保持 UserScript namespace、IndexedDB 数据库与现有 `jhs_*` / `jhs-*` 标识兼容。
- 不新增不必要的 CDN 依赖，不把外部数据直接拼接到 `innerHTML` 或 jQuery `.html()`。
- 第三方页面解析变化应附固定 HTML fixture 和对应回归测试。
- 新作品状态逻辑只读取 `stateFlags`，写入统一使用 `StateService`；不得在业务模块调用 legacy 状态写入 API 或 `window.refresh()`。
- Quick Filter 业务层只使用 `blockedItems` 等 canonical key；旧 `filter` 仅允许在兼容 normalizer 和迁移测试夹具中出现。hard-hidden 是手动屏蔽与关键词/演员规则的派生 union，不写回 `stateFlags`。
- 云盘按钮与 Provider 选择统一由 `UnifiedOfflinePlugin` 管理；新增 Provider 必须保留 capability filtering，并为 Magnet/ED2K 路由补测试。
- 宿主专用 CSS 必须放在对应兼容插件并按 `siteContext` 限定，不得把宿主选择器放入 Theme，也不得用模糊选择器扩大清理范围。
- 涉及持久化结构时必须补迁移、future-version 拒绝、崩溃恢复与导入兼容测试；构建后同步根目录 `JHS.user.js`，`dist/` 仅用于本地字节一致性验证。

## 提交前验证

运行 `npm run check`、`git diff --check` 和 `codegraph sync`。版本发布变更还需同步 `package.json`、`package-lock.json`、`src/main.js` 和 `CHANGELOG.md`，重新生成根目录及 `dist/` 的 `JHS.user.js` 并确认二者字节一致。版本号变更合并至 `main` 后会自动创建正式标签和 GitHub Release，请勿在普通功能或文档提交中随意升版。

提交信息使用 `类型: 中文标题`，并在正文说明改动、原因和实际验证结果。
