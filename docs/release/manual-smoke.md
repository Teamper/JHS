# Tampermonkey 人工 Smoke 记录

从 v6.5.0 开始，正式候选产物必须在 Edge 或 Chrome 中通过真实 Tampermonkey Smoke。自动 Playwright fixture 不能代替这项检查。

测试完成后创建 `docs/release/manual-smoke-v<version>.json`，记录实际环境和被测试的 `JHS.user.js` SHA256。不得提交占位或推测结果。

```json
{
  "version": "6.5.0",
  "testedAt": "2026-08-25T12:00:00.000Z",
  "tester": "实际测试人",
  "browser": {
    "channel": "msedge",
    "version": "实际浏览器版本"
  },
  "userscriptManager": {
    "name": "Tampermonkey",
    "version": "实际扩展版本"
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
    "mobile.realViewport": true
  },
  "notes": "可选的异常、账号状态或环境说明"
}
```

运行：

```bash
npm run check:release-smoke
```

6.4.x 开发基线会明确跳过；版本达到 6.5.0 后，缺少记录、环境字段、任一检查结果或产物哈希不匹配都会失败。需要在版本冻结前预演时，可执行：

```bash
node scripts/manual-smoke-check.mjs --require --record <记录文件>
```
