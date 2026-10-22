## 改动说明

- 解决的问题：
- 采用的方案：
- 兼容性影响：

## 验证

根据 [开发与发布说明](../docs/development.md) 填写适用项；纯文档修改注明不适用，不重新生成产物。

- [ ] 代码修改已运行 `npm run check`；纯文档修改注明不适用
- [ ] `git diff --check`
- [ ] develop 源码修改已生成 `dist/dev/JHS-7.0.dev.user.js`，正式 `JHS.user.js` 未被改写
- [ ] 开发版交付已执行 `npm run build:dev:deliver`，提交根目录 `JHS-7.0.dev.user.js` 并核对与 dist Dev 文件字节一致
- [ ] main 正式版本修改已重新构建根目录 `JHS.user.js`，并确认它与本地 `dist/JHS.user.js` 字节一致；纯文档修改注明不适用
- [ ] UI / 交互修改已记录浏览器、视觉与启动性能的实际结果，失败、跳过与实站验收分别说明
- [ ] 未改变 `JAV-JHS`、`jhs_*`、`jhs-*` 等兼容标识
- [ ] 新状态业务只读取 `stateFlags`，且未新增 legacy 状态写入或 `window.refresh()` 调用
- [ ] Quick Filter 使用 canonical key，hard-hidden 派生原因未写入 `stateFlags`
- [ ] 云盘变更保留 Provider capability filtering，宿主 CSS 已按 `siteContext` 限定
- [ ] 未直接拼接不可信外部数据到 `innerHTML` / `.html()`
- [ ] 普通 develop 修改已记录 `Unreleased`；如修改正式版本号，已同步 `package.json`、`package-lock.json`、`src/main.js`、`CHANGELOG.md` 和根目录 `JHS.user.js`
- [ ] 已确认稳定版本严格递增并推送到 `main`，且依赖 CI 门禁全部通过后，才会自动创建正式标签和 GitHub Release
