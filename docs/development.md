# 分支、构建与验证

本页按当前 main/develop 的实现说明开发流程。命令定义以所在分支的 [package.json](../package.json)、[浏览器子项目](../tests/browser/package.json)、[CI](../.github/workflows/ci.yml) 和构建脚本为准。

## 分支与版本

| 项目 | main | develop |
| --- | --- | --- |
| 用途 | 6.5 正式维护与发布，当前稳定版 6.5.2 | 7.0 开发、修复和回归 |
| 源码稳定元数据 | 6.5.2 | 沿用 6.5.2，Dev 身份由构建时生成 |
| 默认 `npm run build` | `scripts/build.mjs`，生成正式双产物 | `scripts/build-dev.mjs`，仅生成 7.0 Dev |
| 默认产物 | 根目录 `JHS.user.js` 与 `dist/JHS.user.js` | `dist/dev/JHS-7.0.dev.user.js` |
| `npm run build:dev` | 6.5 调试脚本 `dist/dev/JHS.dev.user.js` | 与默认 build 相同 |
| `npm run build:dev:deliver` | 不适用 | 同时更新根目录 `JHS-7.0.dev.user.js`，与 dist Dev 文件字节一致 |
| Dev 名称和版本 | `JHS Dev 6.5` / `6.5.0.dev.<UTC 时间戳>`，这是当前调试构建器的元数据 | `JHS Dev 7.0` / `7.0.0-dev.<UTC 时间戳>` |
| 正式构建入口 | `npm run build` | `npm run build:release`，仅用于明确的正式发布准备 |
| CI 分支配置 | main 当前工作流列出 main、refactor/6.5 | develop 当前工作流列出 main、develop |
| 正式发布 | main push、稳定版本严格递增且依赖门禁通过 | develop push 只检查，不发布 |

`build:dev` 在两条分支都使用独立安装身份，移除正式更新地址并检查正式产物哈希未变。develop 还在页面根元素写入 `data-jhs-dev-build`，包含 Dev 版本、源码提交及 dirty 标识。UTC 时间戳不等于本地时区时间。

## 安装与交付开发版

`develop` 跟踪的完整脚本为 [JHS-7.0.dev.user.js](../JHS-7.0.dev.user.js)。用户可直接 [安装 Raw 脚本](https://raw.githubusercontent.com/Teamper/JHS/develop/JHS-7.0.dev.user.js)，无需本地构建。安装时核对名称 `JHS Dev 7.0`，只启用一个 JHS；Dev 更新从同一入口重新安装。

准备交付时先完成源码检查，再执行：

```bash
npm run build:dev:deliver
node --check JHS-7.0.dev.user.js
```

该命令由构建器同时输出根目录和 dist 的完整 Dev 脚本，不手工编辑产物。将根目录 Dev 文件与本次改动一起提交；也可在源码提交后生成独立的产物提交，使构建标识指向已提交源码。普通 `npm run build` / `npm run check` 仍只写忽略的 dist，不刷新仓库交付快照。正式 `JHS.user.js` 与 `dist/JHS.user.js` 始终保留。

`npm run analyze:bundle` 在 `output/static-resource-size/` 生成同一 Dev 元数据的 `unpacked.user.js`、`packed.user.js` 和 `size-report.json`，报告包含最终 UTF-8 字节、解码器与许可证成本、资源来源及未编码模块贡献。资源编码只处理登记的固定 CSS/HTML 文本，保持单文件与源码明文，不增加线上依赖或存储格式。

资源编码目前默认关闭，候选构建使用 `JHS_PACK_STATIC_RESOURCES=1`；须在等价性、启动、功能与视觉验收完成后再调整默认值。PowerShell 示例：

```powershell
$env:JHS_PACK_STATIC_RESOURCES = "1"
npm run build:dev
Remove-Item Env:JHS_PACK_STATIC_RESOURCES
```

候选验证时同样向 `npm run check` 与浏览器构建传入该环境变量。`dist/dev/JHS-7.0.dev.size.json` 记录本次 Dev 构建的资源成本。对照启动测试可将 `JHS_STARTUP_BUNDLE` 指向其中一份产物，并分别设置 `JHS_STARTUP_MODE=cold` / `warm`；每站点默认 30 次采样，历史绝对门禁与两份产物的相对变化分别报告。

CI 的 Node 22 完整检查、浏览器功能和视觉任务显式验证编码候选，沿用原体积、启动与视觉门禁；Node 20 任务保留默认未编码构建覆盖。该 CI 配置不改变普通 Dev 构建的默认值。

日常功能分支以 develop 为基础，正式发布准备完成后再按授权合入 main。main 热修复须在 24 小时内同步到 develop；develop 的 `scripts/check-refactor-sync.mjs` 检查 origin/main 的祖先关系和提交年龄。

开始前检查：

```bash
git status --short
git branch --show-current
git worktree list
```

当前检出可能是历史 refactor 分支。对已有未提交内容使用隔离工作树，不用切换、重置或清理命令覆盖它。不要因为两条分支版本元数据相同而互换构建命令。

检查工作区时分别核对各工作树的 `git status --short`。本地 `main`、`develop` 与 `origin/main`、`origin/develop` 可能指向不同提交；远端跟踪引用也只是最近一次获取的记录，查看本地状态不等于已核对服务器。文档同步不隐含合并、重置、清理或提交其他工作树的改动。

## 架构与修改归属

两条分支均从 `src/main.js` 进入 `bootstrapJhs`，使用 app/contracts/platform/services/integrations/features/ui 分层。main 仍保留 PluginManager/BasePlugin 执行业务；develop 由 FeatureRuntime 激活 manifest 和 Contribution，CompatibilityBeanRegistry 提供旧 `getBean()` 等兼容入口。

新增行为进入对应 Feature/Service/View，通过 contracts 和 HostAdapter 访问下层或宿主页面；旧兼容入口不作为 develop 新功能的归属。功能范围查 manifest catalog，职责查 [Ownership](architecture/ownership.md)，路由与能力查 [Feature Matrix](architecture/feature-matrix.md)，设计约束查 [ADR](architecture/adr/README.md)。

保持 UserScript 正式身份、`JAV-JHS` / `appData`、设置键、备份格式与业务公共接口兼容。状态写入经 StateService；设置写入经 SettingsService；云盘提交保留 Provider capability filtering。第三方解析变化补固定 HTML fixture，持久化变化补迁移、未来版本拒绝、恢复与导入兼容测试。

7.0 WebDAV 多端同步的锁、提交日志、设置校验及快照策略以 [ADR-013](architecture/adr/013-webdav-sync-recovery.md) 为准。远端应用在业务锁内落地，设置刷新和界面广播在锁释放后安排；新设置描述符须声明兼容其实际消费者的同步校验。面向用户的操作与当前验证边界见 [同步与恢复说明](webdav-sync.md)。

## 验证与证据

根项目支持 Node.js ≥20；完整检查和独立浏览器子项目使用 Node.js ≥22。

| 命令 | 覆盖范围 |
| --- | --- |
| `npm run test` | Vitest 单元与契约回归 |
| `npm run check` | 单元、所在分支默认构建、类型/架构/集成/预算、发布契约、源码与 UI 审计 |
| `npm run check:browser` | 先启动性能，后功能回归 |
| `npm --prefix tests/browser run test:functional` | 独立功能回归；不代表启动性能通过 |
| `npm run check:visual` | 锁定浏览器中的截图差异 |
| `npm run check:release` | check、浏览器、视觉依次全部通过 |
| `git diff --check` | 补丁格式；另核对实际改动范围 |

代码修改运行相关测试及 check；UI/交互变化补相应浏览器和视觉回归。纯文档变化只需核对命令、链接和实际 diff，无需重新构建、升版或更新截图。

`check:browser` 使用串行条件执行，启动性能失败会阻断功能回归；`check:release` 中前项失败也会阻断后项。需要独立运行后续检查时分开执行并分别报告结果，不能把单独通过的功能/视觉检查写成完整门禁通过。

启动性能测试通过 Base64 传输源码字节，在浏览器中原生解码为原始 UTF-8 内联脚本，避免 Chromium 调试协议处理大段非 ASCII 参数的额外耗时。读文件、编码、传输、解码及全部 eager 功能完成仍计入计时；独立冷上下文、30 个样本、`first-ready` 定义和预算均保持不变。这是 fixture 测量开销的修复，不代表正式用户脚本自身启动加速；普通功能测试沿用原有注入方式，并有两种传输方式的等价性回归。

本地功能回归默认使用已安装的 Edge；Windows PowerShell 可用 `$env:JHS_BROWSER_CHANNEL = 'chrome'` 选择已安装的 Chrome。视觉回归使用锁定的 Playwright Chromium，并固定灰度文字抗锯齿；Windows CI 还将当前 runner 会话的系统菜单字体设为 `Microsoft YaHei UI`，与现有基线的 `system-ui` 映射一致，保留产品 CSS。只维护 Windows（`win32`）截图基线。develop CI 的启动和功能回归在 Ubuntu 24.04 上运行，视觉门禁在 Windows Server 2025 上运行；发布依赖两项检查全部通过。Firefox 控件项目与六视口配置以实际 Playwright 配置为准。

浏览器子项目首次准备：

```bash
npm --prefix tests/browser ci
cd tests/browser
npx playwright install chromium
cd ../..
```

这是显式安装视觉浏览器的步骤；本地功能检查不会自动下载浏览器。develop 完整功能回归还包含 Firefox 控件项目，需在 tests/browser 中运行 `npx playwright install firefox`（Linux 可加 `--with-deps`）。develop CI 的 Linux 功能作业安装 Chromium 和 Firefox，Windows 视觉作业只安装 Chromium。

fixture 自动回归与真实登录站点验收分别记录。实站验收先核对管理器版本及 develop 页面构建标识，再验证对应滚轮、焦点、Viewer、关闭/重开等操作。第三方网络、登录状态和资源变化会影响实站，fixture 通过不能替代安装后的验证。

本地可用 `pwsh -File tests/browser/scripts/configure-visual-font.ps1 -CheckOnly` 只读核对系统字体；配置脚本只允许在临时 GitHub Actions runner 中修改字体，不写入持久用户配置。

视觉基线按实际审图结果逐项更新，注明平台、视口、主题和预期变化；不得批量接受未审图差异。历史发布记录中的 PASS 只代表其标注版本及当时环境，不代表当前 main/develop。

## 产物、版本与提交

- develop 日常构建保留根目录正式产物和 `dist/JHS.user.js`。本地 Dev 文件位于忽略的 dist 中；开发版交付须用 `npm run build:dev:deliver` 更新受版本控制的根目录 `JHS-7.0.dev.user.js`，核对两份 Dev 文件字节一致。
- main 源码变化用正式构建维护跟踪的根目录产物，并核对与 dist 字节一致。纯文档改动不重建。
- 用户可见变化记录到 CHANGELOG 的 Unreleased；不为修复或文档任务自动升稳定版本。
- 正式升版同步 package.json、package-lock.json 顶层与根包版本、src/main.js 元数据、CHANGELOG 对应版本段落和根目录产物，由 release-contract 校验。
- main 版本递增后推送会触发 CI 正式发布流程；develop 和 workflow_dispatch 不创建正式 Release。
- 提交、推送、PR、合并和发布按各自授权执行。暂存前查看实际 diff，仅选择本任务文件，保留用户未提交内容。


### 持续浏览性能验证

`tests/browser/specs/continuous-browsing-performance.spec.js` 使用拦截网络的 JavDB 夹具，覆盖 40/200/1000 张卡片、1000/10000 条本地记录，以及两个前台同步周期。同步客户端是内存实现，不连接真实 WebDAV。报告包含原生滚动采样、单影片刷新耗时、处理卡片数、布局/脚本耗时和堆大小；合成结果不能代替安装后的实站验收。

```powershell
npm run build:dev
npm --prefix tests/browser run test:functional -- specs/continuous-browsing-performance.spec.js --project=desktop-wide
```

对照旧产物时设置 `JHS_TEST_BUNDLE_PATH` 和 `JHS_PERF_BASELINE=1`；只在对照运行中关闭新增的增量工作量断言，当前实现仍需完整断言。通过 `JHS_BROWSER_OUTPUT_DIR` / `JHS_BROWSER_REPORT_DIR` 隔离报告，避免覆盖其他验证结果。启动门禁和包体预算继续独立执行。

实站诊断可在浏览器控制台显式启动现有诊断服务，采集默认关闭，只保存有限数量的数值统计，不记录页面正文或凭证。完成采样后断开观察器：

```javascript
const diagnostics = window.pluginManager.diagnostics;
diagnostics.startPerformanceCapture();
// 滚动、收藏、筛选，并观察至少两个同步周期。
diagnostics.stopPerformanceCapture();
console.log(diagnostics.performanceSnapshot());
```

`longTasks` 和 `longFrames` 是整页观测，不能直接归因于 JHS；`interactionP95` 只基于浏览器 Event Timing 提供的有限样本，不是正式 INP。需要归因时结合浏览器 Performance 录制中的调用栈、布局和垃圾回收信息。`work` 保存列表处理量、同步核对领域数、投影记录数、规范化序列化字符数与元数据写入次数。`computations` 保存有界的数值阶段统计，包括累计计算时间、最长协作时间片、处理步数、让出次数，以及存储锁等待/持有时间；它不包括所有浏览器原生克隆和布局成本。

自动重任务在首屏就绪至少 2 秒、连续 500 ms 无输入后领取下一批。等待使用单调时钟，系统界面控件仍按原有空闲回调挂载，不受持续输入阻塞。恢复日志、迁移及撤销资格仍属于必要的业务读取；持有业务锁期间只做 CPU 让出，不等待用户空闲。连续计算优先通过 MessageChannel 回到普通任务队列，避免 scheduler.yield 的优先续跑持续压住宿主定时器；仅在无 MessageChannel 时使用原生 yield 或计时器回退。显式同步请求可提升等待中的任务，自动在线/可见性唤醒仍经过安静门槛。

混合资料库的悬浮与落库对照可运行：

```powershell
npm --prefix tests/browser run test:functional -- specs/responsive-sync-performance.spec.js --project=desktop-wide
```

该夹具拦截全部网络，包含 40/200/1000 张卡片、1000/10000 条影片、大量演员新作品及历史记录；分别记录同步刚启动时和已持有同步计算锁时发起的状态提交。悬浮到下一帧、请求等待、真实落库和同步完成时间分开报告。默认关闭 JHS 的可选诊断，避免诊断自身改变前后比较；需要阶段归因时单独设置 `JHS_PERF_DIAGNOSTICS=1`。
