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
    "javdb.hitShow": true,
    "javdb.top250": true,
    "history.crossPageSelection": true,
    "list.quickFilters": true,
    "list.batchActions": true,
    "list.fc2Navigation": true,
    "list.fc2Lookup": true,
    "detail.reviews": true,
    "detail.related": true,
    "detail.magnetHub": true,
    "detail.nativeMagnetFilter": true,
    "detail.preview": true,
    "detail.screenshot": true,
    "detail.externalSites": true,
    "settings.liveReconfigure": true,
    "settings.quickPanel": true,
    "settings.importExport": true,
    "identity.imageSearch": true,
    "identity.actressInfo": true,
    "failure.optionalContributionIsolation": true
  },
  "notes": "可选的异常、账号状态或环境说明"
}
```

## 37 项真人核对清单

以下每项都必须在真实 Edge/Chrome + Tampermonkey 环境中完成，并在记录中填为 `true`；自动 fixture、单元测试和开发者工具脚本不能替代这些结果。

基础页面与发现：

- `javdb.list`：打开 JavDB 普通列表，确认列表工具栏、卡片状态和导航可用。
- `javdb.detail`：打开 JavDB 详情，确认详情工作区和状态操作可用。
- `javbus.list`：打开 JavBus 普通列表，确认卡片整理、状态和图片入口可用。
- `javbus.detail`：打开 JavBus 详情，确认原生增强、状态按钮和资源区可用。
- `javdb.hitShow`：打开热播页，确认日/周/月切换、筛选、排序和卡片渲染。
- `javdb.top250`：打开 Top250，确认榜单、封面、筛选和状态操作。
- `mobile.realViewport`：用真实窄屏/横屏设备或浏览器视口检查移动入口、FAB、滚动和安全区。

列表、历史与 FC2：

- `history.crossPageSelection`：历史结果跨页全选、取消部分和批量操作，确认 selection 不丢失。
- `list.quickFilters`：切换全部、收藏、下载、观看、屏蔽和待鉴定，确认显隐语义正确。
- `list.batchActions`：执行批量收藏/下载，确认只影响真实 selection 且完成后状态刷新。
- `list.fc2Navigation`：从 FC2 列表卡片打开对话框、拥有页和新标签页回退路径。
- `list.fc2Lookup`：验证 FC2 号码查找及 123AV/JavDB 来源回退。
- `fc2.ownedDetail`：打开 FC2 owned detail，确认原生详情、资源、状态和关闭行为。
- `fc2.autopagePage2`：在 FC2 自动翻页场景实际加载第二页并确认追加结果。

详情资源与外部桥接：

- `detail.reviews`：展开评论并加载更多，确认失败时详情其余区域仍可用。
- `detail.related`：展开相关内容，确认加载、折叠和失败降级。
- `detail.magnetHub`：打开磁力搜索面板，确认来源、失败提示和关闭行为。
- `detail.nativeMagnetFilter`：切换原生磁力过滤开关，确认筛选与恢复全部结果。
- `detail.preview`：打开封面/视频预览，确认请求失败不破坏详情。
- `detail.screenshot`：打开截图/查看器，确认图片加载和查看器层级。
- `detail.externalSites`：检查第三方站点链接、检测和安全打开行为。
- `translation.nativeFallbackAndCache`：验证原生翻译、失败回退和缓存复用。
- `detail.viewerAboveLayer`：在普通弹窗上打开图片查看器，确认查看器层级更高。
- `cloud.115`：验证 115 匹配/离线入口及失败反馈。
- `cloud.123`：验证 123 云盘入口、令牌和离线流程。
- `cloud.123.confirmClose`：在 123 确认成功后确认详情页按设置正确关闭。

设置、禁用与故障隔离：

- `settings.crossTabSync`：标签页 A 修改设置，确认标签页 B 收到并应用变化。
- `settings.liveReconfigure`：打开→关闭→再打开相关开关，确认 UI 和请求生命周期正确。
- `settings.quickPanel`：验证顶部/mini/移动快捷设置入口和保存。
- `settings.importExport`：执行设置导出、导入和失败恢复，确认格式与原有配置保留。
- `dialog.layeredBlacklistSettingsWebdav`：验证黑名单、设置和 WebDAV 弹窗层叠与关闭。
- `backup.loadingAboveSettings`：备份/导入 loading 时确认反馈层覆盖设置弹窗。
- `plugin.disabledNewVideo`：禁用 NewVideoPlugin 后确认无死按钮且核心列表可用。
- `plugin.disabledBlacklist`：禁用 BlacklistPlugin 后确认无死按钮且核心列表可用。
- `failure.optionalContributionIsolation`：让单个可选贡献失败，确认其他 Feature/Contribution 仍可用并可诊断。

身份与演员：

- `identity.imageSearch`：从 JavDB/JavBus 图片入口选择图片并验证识图结果或失败提示。
- `identity.actressInfo`：打开演员信息入口，确认头像、资料链接和失败降级。

6.5 的 Smoke 必须额外覆盖本次重构的危险边界：双标签设置同步、FC2 自动翻页第二页、黑名单→设置→WebDAV 层叠弹窗、禁用 NewVideoPlugin/BlacklistPlugin 后的按钮能力、115 与 123 云盘，以及翻译原生请求回退与缓存清理、详情图片预览层级、备份 Loading 层级、123 确认后的详情页关闭。7.0 Stabilization 还必须覆盖 HitShow/Top250、历史跨页选择、列表快速筛选/批量/FC2 导航与查找、详情评论/相关/磁力/预览/截图/第三方站点、设置实时重配置/快捷面板/导入导出、身份识图/演员信息，以及单贡献故障隔离；当前门禁共要求 37 项真实检查。

运行：

```bash
npm run check:release-smoke
```

6.4.x 开发基线会明确跳过；版本达到 6.5.0 后，缺少记录、`humanVerified`、环境字段、任一检查结果或产物哈希不匹配都会失败。需要在版本冻结前预演时，可执行：

```bash
node scripts/manual-smoke-check.mjs --require --record <记录文件>
```
