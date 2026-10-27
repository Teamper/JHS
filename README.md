<div align="center">

# JHS 7.0 Dev

**JAV Helper Suite**

JAV 浏览、收藏与信息增强脚本

[![Version](https://img.shields.io/badge/version-7.0_Dev-f59e0b)](https://github.com/Teamper/JHS/tree/develop)
[![Userscript](https://img.shields.io/badge/Tampermonkey-userscript-f59e0b)](https://raw.githubusercontent.com/Teamper/JHS/develop/JHS-7.0.dev.user.js)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-43853d)](package.json)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)

[安装 7.0 开发版](https://raw.githubusercontent.com/Teamper/JHS/develop/JHS-7.0.dev.user.js) · [安装正式版](https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js) · [查看更新记录](CHANGELOG.md) · [反馈问题](https://github.com/Teamper/JHS/issues)

</div>

JHS 将作品状态、演员收藏、新作追踪、外部检索、媒体预览、字幕搜索、云盘离线和数据备份整合到站点页面中。脚本按站点和页面启用所需功能，并针对桌面端和移动端提供对应交互。

本页对应 **`develop` 分支的 7.0 开发版**。完整安装脚本为根目录的 [JHS-7.0.dev.user.js](JHS-7.0.dev.user.js)，正式版仍为 6.5.2，见 [main 分支](https://github.com/Teamper/JHS/tree/main)。

> 本项目仅提供网页信息整理与效率增强能力。请遵守所在地法律、目标网站条款及第三方服务规则，并仅处理你有权访问的内容。

## 7.0 开发进展

开发版已包含正式 6.5.2 的筛选和新作品补位行为，并继续提供：

- **WebDAV 全自动多端同步**：配置一次后，电脑、手机、不同浏览器及 JavDB/JavBus 自动拉取、合并和上传数据与个性化设置；新库每端默认保留最近 5 份及过去 7 个 UTC 日期的每日版本，旧库沿用原策略，详见 [同步与恢复](docs/webdav-sync.md)。
- **详情鉴定快捷键**：普通详情、FC2 页面与弹窗共用四状态快捷键，在“列表与详情”录制、清除并保存，默认留空。
- **列表与弹窗交互修复**：历史跨页选择与批量目标保持一致；新作品筛选、分页和关闭重开时保留当前条件，处理迟到响应和焦点恢复。
- **数据与凭证恢复**：同一浏览器跨站共享加密的 WebDAV 连接；备份恢复保留目标设备凭证，导出与状态事务协调；离线结果待确认时先核实再重试。

完整变化见 [Unreleased](CHANGELOG.md#unreleased)。2026-10-26—27 本地验证中，完整检查、脚本体积预算、Chrome 桌面/手机功能回归及六视口浅深主题视觉门禁已通过；最终候选另行通过相关功能及交互回归，原生 IndexedDB 覆盖逐写中止、页面关闭、真实配额失败、跨标签冲突、旧版本迁移和 6.5 稳定脚本回读。Edge 各 30 次冷启动 P50 均为 234.8ms，通过 JavDB 242ms、JavBus 253ms 原上限。独立串行性能已建立 30 次、45 项 P50/P95 参考；最终候选在排除其他测试进程及无关定时演员扫描后，仍未通过原参考值 10% 门槛：首次复测 8 个分位指标超限，后续复测 15 个超限，未提高参考值。安装后 Chrome 已核对运行标识，设置、历史记录、离线历史、新作品搜索及普通详情截图和评论实测通过；扩展内完整脚本哈希、真实 WebDAV 账号、云盘提交及换账号写入仍未验收。此前 JavStore 直接访问显示 500 Server Error，后续详情页成功显示截图，不代表来源已持续恢复。

## 功能概览

| 分类 | 主要能力 |
| --- | --- |
| 状态管理 | 收藏、已下载、已观看和主动屏蔽可独立组合；支持待鉴定、屏蔽项、全部未下载等智能筛选、跨页批量收藏和标记已下载 |
| 演员管理 | 收藏演员、演员黑名单、演员信息补充、收藏同步与已收藏演员高亮 |
| 新作追踪 | 按规范化番号聚合演员新作，支持搜索、类别/VR/状态/决策筛选、多选状态、忽略、暂缓、恢复及“从新作列表移除” |
| 内容过滤 | 手动屏蔽、关键词和演员规则命中的作品统一在“屏蔽项”中查看；自动过滤不会改写作品状态 |
| 外部信息 | 增强 JavDB 分类影片榜、热播和 TOP250，聚合相关作品、评论、FC2 信息、预告片与外部站点入口 |
| 磁力辅助 | 多来源搜索、重复结果合并、字幕标识、评分与高亮；选中资源后可提交到已启用且支持该资源的云盘 |
| 图片与视频 | 多截图源顺序回退、分源缓存、封面查看、悬浮大图和预览视频 |
| 字幕与翻译 | SubtitleCat 字幕搜索、标题翻译和相关快捷入口 |
| 数据工具 | 本地/WebDAV 备份与恢复、多端自动同步、迁移快照、数据体检、操作撤销和意外中断后的状态恢复；备份不携带安装凭证 |
| 统计与诊断 | 全库只读概览、当前页屏蔽项入口、6.4.0 起的 7/30 天活动趋势、日志覆盖范围、功能启动和外部请求诊断 |

## 支持范围

| 页面或站点 | 支持内容 |
| --- | --- |
| JavDB | 列表、详情、演员、进阶检索、分类影片榜、热播、TOP250 和 FC2 分类浏览；兼容层会隐藏已确认的宿主广告容器 |
| JavBus | 列表页、详情页、图片/视频预览及主要状态功能 |
| 123 云盘 | 默认启用并支持 Magnet；在 123 云盘页面同步授权，未同步时会在统一服务选择器中显示明确状态 |
| 115 | 默认关闭，启用并登录后支持 Magnet / ED2K；提供离线历史、详情/列表文件匹配、播放和确认后重命名 |
| JavTrailers | 预告片辅助页面 |
| SubtitleCat | 字幕搜索辅助页面 |

外部检索和媒体信息依赖第三方站点。目标站点改版、访问限制或地区网络差异，均可能使单项能力暂时不可用；核心状态数据不依赖这些外部结果。

## 安装

### 1. 准备用户脚本管理器

在浏览器中安装 Tampermonkey 或兼容的用户脚本管理器，并允许其运行用户脚本。

### 2. 安装 7.0 开发版

点击 **[安装 7.0 开发版完整脚本](https://raw.githubusercontent.com/Teamper/JHS/develop/JHS-7.0.dev.user.js)**，在用户脚本管理器中确认名称为 `JHS Dev 7.0`、版本为 `7.0.0-dev.<UTC 时间戳>`。

只启用一个 JHS 脚本，切换前先导出数据备份。Dev 不配置正式版更新地址，更新时从上述入口重新安装。也可下载仓库根目录的 `JHS-7.0.dev.user.js`，通过管理器导入。

需要正式版时使用 [最新 Release](https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js)。根目录 `JHS.user.js` 保留正式 6.5.2 产物。

### 3. 打开支持的站点

访问 JavDB 或 JavBus。脚本会根据站点和页面类型自动启用所需功能；可从页面中的 JHS 设置入口调整功能、任务间隔、显示方式和外部站点地址。

开发版可在控制台运行 `document.documentElement.getAttribute("data-jhs-dev-build")` 核对版本和源码提交。WebDAV 同步入口为“设置 → 备份与数据 → 多端自动同步”，保存完整连接后自动接入；配置与恢复步骤见 [说明](docs/webdav-sync.md)。

## 推荐使用流程

1. 在“待鉴定”或智能视图中用四个独立状态整理作品；主动屏蔽不会清除其他状态。
2. 收藏演员后，在“新作品”中按番号、演员、VR、状态或决策筛选，再对选择项批量处理。
3. 在详情页聚合资源并选择需要的 Magnet 或 ED2K；统一离线入口只会列出当前已启用且能力兼容的 123/115 服务。
4. 在“鉴定记录”查看状态、可撤销操作和离线任务；离线重试会创建关联的新记录，不覆盖原记录。
5. 在设置页配置自动过滤、WebDAV、云盘和外部来源；升级或大量操作前保留备份。

移动端可从右下角悬浮菜单访问鉴定、新作品、黑名单、排序、筛选和设置。

启用“浏览后自动移除新作品标记”后，新作品列表中的已浏览卡片会渐隐移除，并由后续作品补位，保留浏览位置、筛选和其他选择项；最后一页移空时回到上一页，全部移空时显示空状态；减少动态效果时直接完成补位。

列表“更多筛选”中的“全部未下载”显示所有未标记为已下载且未被屏蔽的作品，包括待鉴定、收藏和已看内容。

设置中的“默认显示选项卡”可选择全部筛选，包括“屏蔽项”和“全部未下载”等智能筛选，下次进入列表页生效。

批量操作前请确认提示中的范围。普通列表中的“全部”仍会隐藏屏蔽项；**跨页批量操作选择“全部”时会包含屏蔽项**，确认框会明确说明。

7.0 Dev 仅对能够确认完整番号的影片开放收藏、下载、观看、屏蔽及新作处理。片商名、缺号、仅有 `FC2` 等前缀或页面信息相互冲突时，状态操作暂不可用，浏览与资源入口仍保留；链接中的番号提示不能代替页面真实番号。批量导入和操作会跳过这些条目并报告数量，后台扫描遇到此类条目时保留上次完整结果与成功时间。

旧模糊记录不会自动改号或删除，仍可在历史中查看、导出和显式删除，备份、恢复及同步继续保留原始数据。JavDB 演员解析兼容新旧页面结构；JavBus 普通图库适配旧 Prestige 图片地址。JavStore 截图按完整番号查找，只有目标证据明确且唯一时才使用详情小图；未找到时继续使用现有截图来源顺序。

## 数据、备份与隐私

- 作品状态、演员列表、活动日志、离线历史、新作决策、设置和恢复点默认保存在浏览器 IndexedDB 数据库 `JAV-JHS` 中。
- 升级时按数据版本迁移：旧版状态数据迁移前会创建快照；6.5.0 修复有移除操作记录的空新作记录，并清理旧版公共请求缓存。来自更高数据版本的备份会在写入前拒绝。
- 活动趋势不伪造升级前历史，永久标明仅统计 6.4.0 及之后的操作；发生安全硬上限裁剪时会显示实际覆盖起点。
- 清理浏览器站点数据、重置用户脚本存储或更换浏览器环境，可能导致本地数据丢失；升级或迁移前建议先导出备份。
- 本地导出与 WebDAV 备份用于迁移作品、演员和设置等数据，不包含 WebDAV 连接配置、密码、123/115 授权或本地地址信任设置。恢复时保留目标设备已有的配置和凭证；新设备需重新配置或登录这些服务。
- 7.0 Dev 保存完整 WebDAV 连接后自动同步，旧有效连接升级后自动验证接入；未配置完整连接时零自动请求。请使用可信服务地址，同步文件沿用便携备份加密，不作为服务端不可解密的私密保险箱。
- 同一浏览器的 JavDB/JavBus 共用整条加密 GM 连接；不同浏览器或手机各配置一次。发现不同站点的旧连接冲突时暂停，在设置选择一次；显式保存或清空优先，清空后不会恢复旧密码。
- 修改后去抖 5 秒、连续修改最长 30 秒安排发布，期限跨刷新保留；锁竞争到期后 1 秒重试。离线、长期锁占用或后台节流仍可能延迟。前台每 30 秒、后台每 2 分钟尽力检查。打开、恢复可见和联网时立即追平，全部相关页面关闭后暂停。网络失败按 1、2、4、8、16、30 分钟退避；授权失效暂停。不支持可靠同源互斥时显示原因并暂停自动同步。
- 四个影片状态、演员、新作决策、关键词、标签、活动/离线历史及普通偏好自动合并。移动模式、列数和宽度留在各端并写入该端恢复区；密码、Cookie、Token、云盘授权、信任与运行状态不进入同步库。其他设备的活动只供查看，离线历史不会触发提交或重试。
- `JHS-同步` 目录中的每端完整快照同时用于同步和恢复；新空库默认最近 5 份，加过去 7 个 UTC 日期每天最后一份，重叠去重。新设备继承库中策略，已有库缺少配置时按旧 10 份、30 天兼容，至少保留 3 份。只清理自己的旧文件，先上传并回读、列出确认，再清理；普通清理错误独立退避，不重复上传或阻止新修改发布。旧手动备份和自动备份目录不改动。旧自动备份上传循环已由新同步接管。
- 首次接入先创建本地恢复点，冲突与删除以云端为准，保留本机独有内容。之后按字段版本合并，旧离线修改不能复活已删除记录，明确重新添加才可重建；历史恢复可选择数据、偏好和布局，并形成新的同步修改。业务数据已保存而同步元数据写入失败时，后续启动/同步会比较完整数据与影子，补齐变化。
- 外部搜索、翻译、字幕、预告片和云盘功能会按需请求对应第三方服务；可在插件管理或设置中关闭不需要的能力。
- 导入数据会先校验可接受的数据结构；执行覆盖性操作前仍建议创建恢复点。

## 项目结构

以下是 `develop` 的 7.0 源码结构；`main` 的正式 6.5.2 仍保留插件执行兼容路径。

```text
src/
├─ main.js                 # UserScript 元数据与启动入口
├─ app/                    # 启动编排、依赖组装与功能运行时
├─ contracts/              # 接口、服务标识与功能声明约定
├─ core/                   # 状态模型、迁移、存储兼容、事件与基础工具
├─ platform/               # 浏览器能力与 JavDB / JavBus 页面适配
├─ services/               # 设置、请求、缓存、凭证和媒体等共享服务
├─ integrations/           # 第三方来源的请求与解析
├─ features/               # 详情、列表批量操作、历史与统计等业务模块
├─ ui/                     # 界面组件、详情分区与交互
├─ compat/                 # 旧名称查询与功能适配接口
└─ plugins/                # 保留的设置、新作品等 UI 实现与兼容入口
scripts/                   # 构建、版本发布契约、源码检查和回归门禁
tests/                     # Vitest 单元测试
└─ browser/                # 浏览器、视觉与启动性能回归
docs/sleazyfork.zh-CN.md    # Sleazy Fork 中文介绍源文件
```

核心运行关系：

```text
src/main.js
  └─ bootstrapJhs
      ├─ 识别站点与页面，组装服务和适配器
      ├─ 加载设置、迁移凭证，注册 Feature / Contribution 与兼容查询入口
      ├─ 迁移业务数据，恢复未完成的状态事务
      └─ 注入样式，由 FeatureRuntime 激活功能并管理生命周期
```

7.0 使用 Feature manifest 声明依赖、站点、路由和启动时机，Contribution 保留旧功能的独立启停粒度。`CompatibilityBeanRegistry` 提供旧 `pluginManager.getBean()` 等查询接口，业务执行由 FeatureRuntime 负责；作品状态由 `StateService` 协调写入。构建器从 `src/main.js` 解析 ES 模块依赖，使用 esbuild 生成经过压缩的 IIFE UserScript，可读源码保留在 `src/`。职责和能力边界见 [Ownership](docs/architecture/ownership.md) 与 [Feature Matrix](docs/architecture/feature-matrix.md)。

## 本地开发

仓库使用两个长期分支：

- `main`：正式版本和发布产物，当前为 6.5.2。
- `develop`：最新 7.0 源码、修复和回归测试，作为开发版本持续验证。

日常开发在 `develop` 上进行，功能分支合入 `develop`；正式发布前完成验证，再通过 PR 合入 `main`。`main` 上的热修复须同步到 `develop`，沿用现有 24 小时同步规则。

分支、构建和验收操作见 [开发与发布说明](docs/development.md)，修改约束见 [贡献指南](CONTRIBUTING.md)。

基础测试与构建支持 Node.js 20；完整开发和浏览器回归使用 **Node.js 22 或更高版本**。

克隆仓库并进入项目根目录后执行：

```bash
git switch develop
npm ci
npm run check
```

`develop` 的默认构建输出为 `dist/dev/JHS-7.0.dev.user.js`，名称为 `JHS Dev 7.0`，版本为带时间戳的 `7.0.0-dev.*`。开发构建保留独立安装身份，不改写正式 `JHS.user.js`，也不配置正式版自动更新地址。安装开发版时只启用一个 JHS 脚本。

交付开发脚本时执行 `npm run build:dev:deliver`，同时生成根目录 `JHS-7.0.dev.user.js` 和 `dist/dev/JHS-7.0.dev.user.js`，两者字节一致。提交根目录 Dev 文件，`dist/` 仍只保留本地构建。普通测试构建不改写已交付的 Dev 文件。

交付前运行 `npm run check:dev:delivery`：使用交付文件自身的 Dev 版本和构建标识重建当前源码，比较完整 SHA256；同一标识下的内容差异也会阻断。`node scripts/check-dev-delivery.mjs --freeze` 可将通过核验的候选保存到 `output/dev-candidates/<SHA256>.user.js`，随后将 `JHS_TEST_BUNDLE_PATH` 指向该文件运行浏览器及视觉检查，避免普通构建改变被测文件。

持续浏览性能单独运行 `npm run check:performance:serial`，固定 Windows Edge、单工作进程，在已有列表、同步和持久化场景采集 30 次 P50/P95。首次使用 `node scripts/check-serial-performance.mjs --record-reference` 显式建立 `performance-reference.json`；后续环境和场景必须一致，任一 P50/P95 超过参考值 10% 即失败。命令不会覆盖已有参考值；已提交的参考上限只允许收紧。原有启动阈值和 `first-ready` 定义保持不变。

Windows 下，串行门禁会在采样前后检查其他 Vitest/Playwright 进程，发现并发则拒绝将该轮作为有效结果，不停止其他项目。各轮采样保存到 `output/serial-performance/<时间与随机标识>/`，最近一轮的位置见 `output/serial-performance/latest.json`。固定环境也包含浏览器、Node、系统版本与硬件；环境不一致时应回到原环境复测，不覆盖参考值。

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run build` | 在 `develop` 构建 `dist/dev/JHS-7.0.dev.user.js` |
| `npm run build:dev` | 构建同一 7.0 开发版本 |
| `npm run build:dev:deliver` | 同时更新仓库根目录的完整 Dev 安装脚本，供 develop 交付 |
| `npm run check:dev:delivery` | 以交付文件自身元数据重建并比较完整 SHA256 |
| `npm run check:performance:serial` | 独立串行 30 次持续浏览采样及 P50/P95 回归门禁 |
| `npm run build:release` | 显式生成根目录及 `dist/JHS.user.js`，仅用于获授权的正式发布准备 |
| `npm run check` | 执行单元测试、构建、类型/架构/集成检查、性能预算、发布契约和 UI 审计 |
| `npm run check:browser` | 运行启动性能与浏览器功能回归 |
| `npm run check:visual` | 检查桌面和移动端截图差异 |
| `npm run check:release` | 依次运行上述完整检查、浏览器回归和视觉回归 |
| `npm run test:watch` | 以监听模式运行测试 |

运行浏览器检查前安装独立测试依赖和视觉检查使用的 Chromium：

```bash
cd tests/browser
npm ci
npx playwright install chromium firefox
cd ../..
npm run check:release
```

本地功能回归目前检查 Windows 已安装的 Edge，可用 `JHS_BROWSER_CHANNEL=chrome` 选择已安装的 Chrome；视觉回归使用 Playwright Chromium。GitHub Actions 在 Ubuntu 上使用临时安装的 Chromium。

`develop` 另有 Firefox 控件项目，只运行控件状态规格；完整运行前需按 [开发与发布说明](docs/development.md) 准备对应浏览器。`check:browser` 先运行启动性能，再运行功能；启动失败会阻断后续功能检查。需要单独排查功能时可运行 `npm --prefix tests/browser run test:functional`，完整门禁仍要求启动性能通过。

普通 `develop` 修改记录在 `Unreleased`，使用 Dev 构建，保留稳定版本元数据和正式产物。正式版本变更才同步维护 `package.json`、`package-lock.json`、`src/main.js`、`CHANGELOG.md` 和根目录 `JHS.user.js`，并确认根目录与 `dist/JHS.user.js` 字节一致。`npm run check` 验证稳定版本格式、版本一致性和发布说明，但在 `develop` 不重新生成正式产物。

用户可见功能或版本变化时，同时更新本页和 [Sleazy Fork 中文介绍](docs/sleazyfork.zh-CN.md)。商店介绍以该文件为源，通过 [Raw 地址](https://raw.githubusercontent.com/Teamper/JHS/main/docs/sleazyfork.zh-CN.md) 同步。

## 质量门禁

完整发布门禁为 `npm run check:release`，包括：

- 单元测试、数据迁移、备份兼容、凭证、状态恢复和撤销回归。
- 类型检查、架构边界、第三方集成、产物大小与性能预算。
- 源码和产物语法、版本一致性、Feature / Contribution 归属、主题对比度及键盘/ARIA 审计。
- 固定页面样本上的浏览器交互、启动性能和桌面/移动端视觉回归。

`main` CI 重新构建并检查根目录 `JHS.user.js` 是否与已提交文件一致；`develop` CI 构建 Dev 产物，并检查正式产物未被改写。自动测试使用固定页面样本和隔离的第三方服务，不会提交真实云盘任务。fixture 通过不代表已安装脚本、登录实站或真实设备验收通过。

安装 7.0 Dev 后，可在浏览器控制台查看功能启动诊断：

```js
const diagnostics = pluginManager.diagnostics.exportSnapshot();
diagnostics.activeFeatures;
diagnostics.activeContributions;
Object.entries(diagnostics.startupTimings).sort((a, b) => b[1] - a[1]);
```

`startupTimings` 记录各 Feature 激活耗时；idle Feature 在首屏就绪后调度。完整启动性能由浏览器规格按固定样本测量，不包含 `@require` 下载和浏览器解析时间。7.0 的旧 `getStartupReport()` / `getTimings()` 仅保留兼容返回值，不用于评估实际启动性能。

## 发布方式

- `main` / `develop` push，以及目标为这两个分支的 PR，均执行 Node 20 兼容检查、Node 22 完整检查、浏览器/视觉回归及对应分支的产物检查。
- `develop` push 只运行开发检查，不创建正式版本标签或 Release。
- `package.json` 的稳定版 `version` 是正式发布信号；`main` 检测到版本严格递增后，CI 自动验证版本契约、创建 annotated `vX.Y.Z` 标签、提取 CHANGELOG 说明并发布 `JHS.user.js`。
- 未修改版本号的提交不会创建 Release；版本回退、指向其他提交的同名标签以及已有 Release 均会阻止发布，历史版本和资产不会被覆盖。
- `workflow_dispatch` 仅运行检查，不会创建标签或 Release。发布失败时应先检查原 `main` push 流水线，再重跑对应任务；已有 Release 不会被覆盖。

正式版入口始终指向 [latest release](https://github.com/Teamper/JHS/releases/latest)，历史变化见 [CHANGELOG.md](CHANGELOG.md)。

## 常见问题

<details>
<summary>安装后页面没有出现 JHS 功能</summary>

确认用户脚本已启用、当前域名符合脚本匹配范围，并刷新页面。仍无效果时，打开浏览器开发者工具查看控制台错误，再附带站点、页面地址类型、浏览器和脚本版本提交 Issue。

</details>

<details>
<summary>某个外部搜索或预览功能突然失效</summary>

这类功能依赖目标站点页面结构和可访问性。可先在设置的网络诊断中查看熔断和请求统计；核心作品状态通常不受影响。

</details>

<details>
<summary>如何迁移到另一台设备</summary>

7.0 Dev 在新设备保存同一 WebDAV 连接即可自动合并数据与偏好，首次接入前会创建本地恢复点。也可以沿用本地导出/导入或手动 WebDAV 恢复；连接配置与云盘授权不会随数据迁移，需在新浏览器配置或登录，目标设备原有凭证保留。详见 [同步与恢复](docs/webdav-sync.md)。

</details>

<details>
<summary>如何反馈问题</summary>

前往 [GitHub Issues](https://github.com/Teamper/JHS/issues)，说明复现步骤、目标站点、脚本版本和控制台错误。请勿提交账号、Cookie、WebDAV 密码或云盘凭据。

</details>

## Star History

<a href="https://www.star-history.com/?repos=teamper%2Fjhs&amp;type=date&amp;legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=teamper/jhs&amp;type=date&amp;theme=dark&amp;legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=teamper/jhs&amp;type=date&amp;legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=teamper/jhs&amp;type=date&amp;legend=top-left" />
  </picture>
</a>

## 许可

用户脚本元数据声明为 [MIT](src/main.js)。第三方网站、接口和脚本依赖分别受其自身条款与许可证约束。
