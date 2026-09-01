# Tampermonkey 人工 Smoke 记录

从 v6.5.0 开始，正式候选产物必须在 Edge 或 Chrome 中通过真实 Tampermonkey Smoke。自动 Playwright fixture 不能代替这项检查。

测试完成后创建 `docs/release/manual-smoke-v<version>.json`，记录实际环境和被测试的 `JHS.user.js` SHA256。**不得提交占位、推测或 bot 生成的记录**：门禁会拒绝 `tester` 含 `bot`、`browser.version`/`userscriptManager.version` 为 `release`/`latest`/`unknown`、以及 `humanVerified` 不为 `true` 的记录。

```json
{
  "version": "6.5.0",
  "testedAt": "2026-08-25T12:00:00.000Z",
  "tester": "实际测试人",
  "humanVerified": true,
  "browser": {
    "channel": "msedge",
    "version": "实际浏览器版本号（如 151.0）"
  },
  "userscriptManager": {
    "name": "Tampermonkey",
    "version": "实际扩展版本号（如 5.4.0）"
  },
  "artifact": {
    "sha256": "JHS.user.js 的小写 SHA256"
  },
  "checks": {
    "javdb.list": true,
    "javdb.detail": true,
    "javbus.list": true,
    "javbus.detail": true,
    "fc2.ownedDetail": true,
    "mobile.realViewport": true,
    "settings.crossTabSync": true,
    "fc2.autopagePage2": true,
    "dialog.layeredBlacklistSettingsWebdav": true,
    "plugin.disabledNewVideo": true,
    "plugin.disabledBlacklist": true,
    "cloud.115": true,
    "cloud.123": true,
    "translation.nativeFallbackAndCache": true,
    "detail.viewerAboveLayer": true,
    "backup.loadingAboveSettings": true,
    "cloud.123.confirmClose": true,
    "install.fresh": true,
    "upgrade.v641ToV650": true,
    "backup.crossInstallRestore": true,
    "newVideo.dismissNoPollution": true,
    "review.defaultEnabled": true,
    "settings.screenshotIndependent": true,
    "cache.clearForcesNetwork": true
  },
  "notes": "可选的异常、账号状态或环境说明"
}
```

6.5 的 Smoke 必须额外覆盖本次重构的危险边界：双标签设置同步、FC2 自动翻页第二页、黑名单→设置→WebDAV 层叠弹窗、禁用 NewVideoPlugin/BlacklistPlugin 后的按钮能力、115 与 123 云盘，以及翻译原生请求回退与缓存清理、详情图片预览层级、备份 Loading 层级、123 确认后的详情页关闭；还要实测全新安装、6.4.1 升级、跨安装备份恢复、NewVideo 移除不污染历史、评论默认开启、截图开关独立和清缓存后真实联网。

运行：

```bash
npm run check:release-smoke
```

6.4.x 开发基线会明确跳过；版本达到 6.5.0 后，缺少记录、`humanVerified`、环境字段、任一强制检查结果或产物哈希不匹配都会失败。需要在版本冻结前预演时，可执行：

```bash
node scripts/manual-smoke-check.mjs --require --record <记录文件>
```
