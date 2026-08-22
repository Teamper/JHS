## 改动说明

- 解决的问题：
- 采用的方案：
- 兼容性影响：

## 验证

- [ ] `npm run check`
- [ ] `git diff --check`
- [ ] `codegraph sync`
- [ ] 如修改源码，已重新构建根目录 `JHS.user.js`，并确认它与本地 `dist/JHS.user.js` 字节一致
- [ ] 未改变 `JAV-JHS`、`jhs_*`、`jhs-*` 等兼容标识
- [ ] 新状态业务只读取 `stateFlags`，且未新增 legacy 状态写入或 `window.refresh()` 调用
- [ ] Quick Filter 使用 canonical key，hard-hidden 派生原因未写入 `stateFlags`
- [ ] 云盘变更保留 Provider capability filtering，宿主 CSS 已按 `siteContext` 限定
- [ ] 未直接拼接不可信外部数据到 `innerHTML` / `.html()`
- [ ] 如修改版本号，已同步 `package.json`、`package-lock.json`、`src/main.js`、`CHANGELOG.md` 和根目录 `JHS.user.js`
- [ ] 已确认版本号变更合并至 `main` 后会自动创建正式标签和 GitHub Release
