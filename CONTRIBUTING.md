# 贡献指南

## 开发约束

- 使用 Node.js 20 或更高版本，安装依赖后从 `src/` 修改源码。
- 保持 UserScript namespace、IndexedDB 数据库与现有 `jhs_*` / `jhs-*` 标识兼容。
- 不新增不必要的 CDN 依赖，不把外部数据直接拼接到 `innerHTML` 或 jQuery `.html()`。
- 第三方页面解析变化应附固定 HTML fixture 和对应回归测试。

## 提交前验证

运行 `npm run check`。版本发布变更还需同步 `package.json`、`src/main.js` 和 `CHANGELOG.md`，并确认根目录 `JHS.user.js` 是最新可读构建产物。

提交信息使用 `类型: 中文标题`，并在正文说明改动、原因和实际验证结果。
