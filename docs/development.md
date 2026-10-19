# 分支、构建与验证

本页按当前 main/develop 的实现说明开发流程。命令定义以所在分支的 [package.json](../package.json)、[浏览器子项目](../tests/browser/package.json)、[CI](../.github/workflows/ci.yml) 和构建脚本为准。

## 分支与版本

| 项目 | main | develop |
| --- | --- | --- |
| 用途 | 6.5 正式维护与发布，当前稳定版 6.5.1 | 7.0 开发、修复和回归 |
| 源码稳定元数据 | 6.5.1 | 沿用 6.5.1，Dev 身份由构建时生成 |
| 默认 `npm run build` | `scripts/build.mjs`，生成正式双产物 | `scripts/build-dev.mjs`，仅生成 7.0 Dev |
| 默认产物 | 根目录 `JHS.user.js` 与 `dist/JHS.user.js` | `dist/dev/JHS-7.0.dev.user.js` |
| `npm run build:dev` | 6.5 调试脚本 `dist/dev/JHS.dev.user.js` | 与默认 build 相同 |
| Dev 名称和版本 | `JHS Dev 6.5` / `6.5.0.dev.<UTC 时间戳>`，这是当前调试构建器的元数据 | `JHS Dev 7.0` / `7.0.0-dev.<UTC 时间戳>` |
| 正式构建入口 | `npm run build` | `npm run build:release`，仅用于明确的正式发布准备 |
| CI 分支配置 | main 当前工作流列出 main、refactor/6.5 | develop 当前工作流列出 main、develop |
| 正式发布 | main push、稳定版本严格递增且依赖门禁通过 | develop push 只检查，不发布 |

`build:dev` 在两条分支都使用独立安装身份，移除正式更新地址并检查正式产物哈希未变。develop 还在页面根元素写入 `data-jhs-dev-build`，包含 Dev 版本、源码提交及 dirty 标识。UTC 时间戳不等于本地时区时间。

日常功能分支以 develop 为基础，正式发布准备完成后再按授权合入 main。main 热修复须在 24 小时内同步到 develop；develop 的 `scripts/check-refactor-sync.mjs` 检查 origin/main 的祖先关系和提交年龄。

开始前检查：

```bash
git status --short
git branch --show-current
git worktree list
```

当前检出可能是历史 refactor 分支。对已有未提交内容使用隔离工作树，不用切换、重置或清理命令覆盖它。不要因为两条分支版本元数据相同而互换构建命令。

## 架构与修改归属

两条分支均从 `src/main.js` 进入 `bootstrapJhs`，使用 app/contracts/platform/services/integrations/features/ui 分层。main 仍保留 PluginManager/BasePlugin 执行业务；develop 由 FeatureRuntime 激活 manifest 和 Contribution，CompatibilityBeanRegistry 提供旧 `getBean()` 等兼容入口。

新增行为进入对应 Feature/Service/View，通过 contracts 和 HostAdapter 访问下层或宿主页面；旧兼容入口不作为 develop 新功能的归属。功能范围查 manifest catalog，职责查 [Ownership](architecture/ownership.md)，路由与能力查 [Feature Matrix](architecture/feature-matrix.md)，设计约束查 [ADR](architecture/adr/README.md)。

保持 UserScript 正式身份、`JAV-JHS` / `appData`、设置键、备份格式与业务公共接口兼容。状态写入经 StateService；设置写入经 SettingsService；云盘提交保留 Provider capability filtering。第三方解析变化补固定 HTML fixture，持久化变化补迁移、未来版本拒绝、恢复与导入兼容测试。

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

本地功能回归默认使用已安装的 Edge；Windows PowerShell 可用 `$env:JHS_BROWSER_CHANNEL = 'chrome'` 选择已安装的 Chrome。视觉回归使用锁定的 Playwright Chromium，只维护 Windows（`win32`）截图基线。develop CI 的启动和功能回归在 Ubuntu 24.04 上运行，视觉门禁在 Windows Server 2022 上运行；发布依赖两项检查全部通过。Firefox 控件项目与六视口配置以实际 Playwright 配置为准。

浏览器子项目首次准备：

```bash
npm --prefix tests/browser ci
cd tests/browser
npx playwright install chromium
cd ../..
```

这是显式安装视觉浏览器的步骤；本地功能检查不会自动下载浏览器。develop 完整功能回归还包含 Firefox 控件项目，需在 tests/browser 中运行 `npx playwright install firefox`（Linux 可加 `--with-deps`）。develop CI 的 Linux 功能作业安装 Chromium 和 Firefox，Windows 视觉作业只安装 Chromium。

fixture 自动回归与真实登录站点验收分别记录。实站验收先核对管理器版本及 develop 页面构建标识，再验证对应滚轮、焦点、Viewer、关闭/重开等操作。第三方网络、登录状态和资源变化会影响实站，fixture 通过不能替代安装后的验证。

视觉基线按实际审图结果逐项更新，注明平台、视口、主题和预期变化；不得批量接受未审图差异。历史发布记录中的 PASS 只代表其标注版本及当时环境，不代表当前 main/develop。

## 产物、版本与提交

- develop 日常构建保留根目录正式产物和 `dist/JHS.user.js`。Dev 文件位于忽略的 dist 中。
- main 源码变化用正式构建维护跟踪的根目录产物，并核对与 dist 字节一致。纯文档改动不重建。
- 用户可见变化记录到 CHANGELOG 的 Unreleased；不为修复或文档任务自动升稳定版本。
- 正式升版同步 package.json、package-lock.json 顶层与根包版本、src/main.js 元数据、CHANGELOG 对应版本段落和根目录产物，由 release-contract 校验。
- main 版本递增后推送会触发 CI 正式发布流程；develop 和 workflow_dispatch 不创建正式 Release。
- 提交、推送、PR、合并和发布按各自授权执行。暂存前查看实际 diff，仅选择本任务文件，保留用户未提交内容。
