# 开发与发布

## 分支与构建

`develop` 用于 7.0 开发及 RC 准备，`main` 对应正式发行。基础测试支持 Node.js 20，完整开发检查和浏览器项目使用 Node.js 22 或更新版本。

```powershell
npm ci
npm ci --prefix tests/browser
npm run check
```

| 命令 | 结果 |
| --- | --- |
| `npm run build` | 生成 `dist/dev/JHS-7.0.dev.user.js`，可用于本地测试 |
| `npm run build:dev:deliver` | 同时生成根目录和 dist 内的 Dev 脚本 |
| `node scripts/check-dev-delivery.mjs JHS-7.0.dev.user.js --freeze` | 从当前源码重建并核对交付脚本的完整 SHA-256，在忽略目录冻结候选 |
| `npm run build:extension` | 生成 `dist/extension/dev`，供 Chrome / Edge 加载 |
| `npm run build:android:web` | 构建 Capacitor Android WebView 前端 |
| `npm run check:mobile` | 检查 Expo 工程并运行其单元测试 |

用户脚本由源码构建。日常 Dev 构建与正式版产物分别使用各自的命令。用 `document.documentElement.getAttribute("data-jhs-dev-build")` 核对当前页加载的 Dev 构建。

## 代码职责

先看 [运行时与代码职责](architecture/ownership.md) 和 [功能与路由](architecture/feature-matrix.md)。Feature 声明依赖、站点、路由和生命周期。业务状态、设置和凭证分别由 StateService、SettingsService 和 CredentialService 管理；平台存储经 StorageService 端口接入。第三方解析变化应补固定 HTML 样本。

## 验证

- `npm run check` 覆盖单元测试、构建、类型、架构、集成和发布契约。包体大小由 `release-invariants.mjs` 检查，Dev 预算为 1.6 MB 软限和 2.0 MB 硬限。`npm run analyze:bundle` 用于查看静态资源和模块贡献。
- 用已安装的 Edge 或 Chrome 做本地网页回归。PowerShell 中设置 `$env:JHS_BROWSER_CHANNEL = 'chrome'` 可选择 Chrome。`npm --prefix tests/browser run test:startup` 和 `npm --prefix tests/browser run test:functional` 可分别运行。开发分支 CI 独立保留启动和功能结果。
- Windows 视觉门禁在 GitHub runner 使用仓库锁定的 Playwright Chromium 和所需字体。审阅实际截图、基线和差异后，仅更新预期变化的基线。
- `npm run check:extension:chrome` 或 `npm run check:extension:edge` 使用隔离配置，验证开发扩展加载、重启后数据和模拟 WebDAV。
- `npm run check:performance:serial` 按当前参考值记录固定环境下的 P50/P95。隔离机器负载及报告目录，保留实际采样、阈值和结果。说明样本、真实账号和实机分别覆盖了哪些场景。

用 `JHS_TEST_BUNDLE_PATH` 指定冻结包，使用 `JHS_BROWSER_OUTPUT_DIR` 和 `JHS_BROWSER_REPORT_DIR` 分开保存证据。

### 页面诊断

打开正在运行 JHS 的页面，在控制台按需开始采样，操作结束后停止并读取快照。

```javascript
const diagnostics = window.jhsDiagnostics;
diagnostics.startPerformanceCapture();
// 操作页面后读取统计。
diagnostics.stopPerformanceCapture();
console.log(diagnostics.performanceSnapshot());
```

## 发行

RC 候选构建、核验和标签流程统一见 [RC 发布流程](../release-notes/README.md#70-rc-候选与发布)。正式版同步更新版本元数据、CHANGELOG 的正式版本区段和对应发布说明，由 `npm run build:release` 生成正式用户脚本。在 `main` 的正式发布门禁通过后，由 CI 创建标签和 Release。

各端验证入口见 [移动端](../apps/mobile/README.md) 和 [Android 离线预览](../apps/android/README.md)。对外商店文案以 [Sleazy Fork 中文介绍](sleazyfork.zh-CN.md) 为源，随正式版本更新。
