<div align="center">

# JHS

**JAV Helper Suite**

JAV 浏览、收藏与信息增强脚本

[![Version](https://img.shields.io/github/v/release/Teamper/JHS?label=version)](https://github.com/Teamper/JHS/releases/latest)
[![Userscript](https://img.shields.io/badge/Tampermonkey-userscript-f59e0b)](https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-43853d)](package.json)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)

[安装正式版](https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js) · [查看更新记录](CHANGELOG.md) · [反馈问题](https://github.com/Teamper/JHS/issues)

</div>

JHS 将作品状态、演员收藏、新作追踪、外部检索、媒体预览、字幕搜索、云盘离线和数据备份整合到站点页面中。脚本以插件方式按页面加载，并针对桌面端和移动端提供对应交互。

> 本项目仅提供网页信息整理与效率增强能力。请遵守所在地法律、目标网站条款及第三方服务规则，并仅处理你有权访问的内容。

## 6.5.0 更新

当前正式版为 **6.5.0**（2026-09-19）。这次主要更新：

- **跨页批量整理**：JavDB / JavBus 的普通列表、搜索和演员页支持跨全部分页收藏或标记已下载，从中间页开始也会回到第一页扫描。热播和 Top250 的批量操作只处理当前榜单页。
- **FC2 详情重做**：影片信息、剧照、资源、评论和相关清单分区显示，适配手机；修复详情、图片查看器和遮罩互相遮挡的问题。
- **热播和 Top250 修复**：修复榜单空白、封面失效、原生搜索结果混入榜单和筛选切换异常；榜单排序与普通列表分别保存。
- **列表和新作行为更明确**：“全部”显示所有未被屏蔽的作品，包括收藏、已下载和已看；从新作列表移除不会再生成空的鉴定记录。
- **设置、云盘和备份更稳**：设置页与快捷入口共用设置，修复关闭功能后旧请求继续回写、云盘重复提交等问题；跨设备恢复备份时保留目标设备的凭证。

完整内容见 [6.5.0 更新记录](https://github.com/Teamper/JHS/releases/tag/v6.5.0)。

## 功能概览

| 分类 | 主要能力 |
| --- | --- |
| 状态管理 | 收藏、已下载、已观看和主动屏蔽可独立组合；支持待鉴定、屏蔽项、智能筛选、跨页批量收藏和标记已下载 |
| 演员管理 | 收藏演员、演员黑名单、演员信息补充、收藏同步与已收藏演员高亮 |
| 新作追踪 | 按规范化番号聚合演员新作，支持搜索、类别/VR/状态/决策筛选、多选状态、忽略、暂缓、恢复及“从新作列表移除” |
| 内容过滤 | 手动屏蔽、关键词和演员规则命中的作品统一在“屏蔽项”中查看；自动过滤不会改写作品状态 |
| 外部信息 | 聚合相关作品、评论、热播、Top 250、FC2 信息、预告片与外部站点入口 |
| 磁力辅助 | 多来源搜索、重复结果合并、字幕标识、评分与高亮；选中资源后可提交到已启用且支持该资源的云盘 |
| 图片与视频 | 多截图源顺序回退、分源缓存、封面查看、悬浮大图和预览视频 |
| 字幕与翻译 | SubtitleCat 字幕搜索、标题翻译和相关快捷入口 |
| 数据工具 | 本地/WebDAV 备份与恢复、迁移快照、数据体检、操作撤销和意外中断后的状态恢复；备份不携带安装凭证 |
| 统计与诊断 | 全库只读概览、当前页屏蔽项入口、6.4.0 起的 7/30 天活动趋势、日志覆盖范围、插件启动和外部请求诊断 |

## 支持范围

| 页面或站点 | 支持内容 |
| --- | --- |
| JavDB | 列表页、详情页、演员页、搜索页及主要管理功能；兼容层会隐藏已确认的宿主广告容器 |
| JavBus | 列表页、详情页、图片/视频预览及主要状态功能 |
| 123 云盘 | 默认启用并支持 Magnet；在 123 云盘页面同步授权，未同步时会在统一服务选择器中显示明确状态 |
| 115 | 默认关闭，启用并登录后支持 Magnet / ED2K；提供离线历史、详情/列表文件匹配、播放和确认后重命名 |
| JavTrailers | 预告片辅助页面 |
| SubtitleCat | 字幕搜索辅助页面 |

外部检索和媒体信息依赖第三方站点。目标站点改版、访问限制或地区网络差异，均可能使单项能力暂时不可用；核心状态数据不依赖这些外部结果。

## 安装

### 1. 准备用户脚本管理器

在浏览器中安装 Tampermonkey 或兼容的用户脚本管理器，并允许其运行用户脚本。

### 2. 安装 JHS

点击 **[安装最新正式版](https://github.com/Teamper/JHS/releases/latest/download/JHS.user.js)**，在用户脚本管理器中确认安装。

安装后的更新来源：

- `@downloadURL`：最新 GitHub Release 中的 `JHS.user.js`
- `@updateURL`：`main` 分支中的构建产物

### 3. 打开支持的站点

访问 JavDB 或 JavBus。脚本会根据站点和页面类型自动注册所需插件；可从页面中的 JHS 设置入口调整功能、任务间隔、显示方式和外部站点地址。

## 推荐使用流程

1. 在“待鉴定”或智能视图中用四个独立状态整理作品；主动屏蔽不会清除其他状态。
2. 收藏演员后，在“新作品”中按番号、演员、VR、状态或决策筛选，再对选择项批量处理。
3. 在详情页聚合资源并选择需要的 Magnet 或 ED2K；统一离线入口只会列出当前已启用且能力兼容的 123/115 服务。
4. 在“鉴定记录”查看状态、可撤销操作和离线任务；离线重试会创建关联的新记录，不覆盖原记录。
5. 在设置页配置自动过滤、WebDAV、云盘和外部来源；升级或大量操作前保留备份。

移动端可从右下角悬浮菜单访问鉴定、新作品、黑名单、排序、筛选和设置。

批量操作前请确认提示中的范围。普通列表中的“全部”仍会隐藏屏蔽项；**跨页批量操作选择“全部”时会包含屏蔽项**，确认框会明确说明。

## 数据、备份与隐私

- 作品状态、演员列表、活动日志、离线历史、新作决策、设置和恢复点默认保存在浏览器 IndexedDB 数据库 `JAV-JHS` 中。
- 升级时按数据版本迁移：旧版状态数据迁移前会创建快照；6.5.0 修复有移除操作记录的空新作记录，并清理旧版公共请求缓存。来自更高数据版本的备份会在写入前拒绝。
- 活动趋势不伪造升级前历史，永久标明仅统计 6.4.0 及之后的操作；发生安全硬上限裁剪时会显示实际覆盖起点。
- 清理浏览器站点数据、重置用户脚本存储或更换浏览器环境，可能导致本地数据丢失；升级或迁移前建议先导出备份。
- 本地导出与 WebDAV 备份用于迁移作品、演员和设置等数据，不包含 WebDAV 连接配置、密码、123/115 授权或本地地址信任设置。恢复时保留目标设备已有的配置和凭证；新设备需重新配置或登录这些服务。
- WebDAV 仅在启用并配置后用于远程备份与恢复，请使用可信服务地址并妥善保管凭据。
- 外部搜索、翻译、字幕、预告片和云盘功能会按需请求对应第三方服务；可在插件管理或设置中关闭不需要的能力。
- 导入数据会先校验可接受的数据结构；执行覆盖性操作前仍建议创建恢复点。

## 项目结构

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
└─ plugins/                # 按业务域组织的插件与兼容入口
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
      ├─ 加载设置、迁移凭证，激活对应功能
      ├─ 迁移业务数据，恢复未完成的状态事务
      └─ 注入样式，由 PluginManager 执行插件任务
```

6.5 使用 ES 模块依赖和统一功能运行时。现有插件仍继承 `BasePlugin`，保留 `getBean()` 等兼容入口；作品状态由 `StateService` 协调写入。构建器从 `src/main.js` 解析模块依赖，使用 esbuild 生成经过压缩的 IIFE UserScript，可读源码保留在 `src/`。

## 本地开发

基础测试与构建支持 Node.js 20；完整开发和浏览器回归使用 **Node.js 22 或更高版本**。

克隆仓库并进入项目根目录后执行：

```bash
npm ci
npm run check
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run build` | 从 `src/` 构建根目录和 `dist/` 下的用户脚本 |
| `npm run build:dev` | 构建开发调试版本 |
| `npm run check` | 执行单元测试、构建、类型/架构/集成检查、性能预算、发布契约和 UI 审计 |
| `npm run check:browser` | 运行启动性能与浏览器功能回归 |
| `npm run check:visual` | 检查桌面和移动端截图差异 |
| `npm run check:release` | 依次运行上述完整检查、浏览器回归和视觉回归 |
| `npm run test:watch` | 以监听模式运行测试 |

运行浏览器检查前安装独立测试依赖和视觉检查使用的 Chromium：

```bash
cd tests/browser
npm ci
npx playwright install chromium
cd ../..
npm run check:release
```

本地功能回归目前检查 Windows 已安装的 Edge，可用 `JHS_BROWSER_CHANNEL=chrome` 选择已安装的 Chrome；视觉回归使用 Playwright Chromium。GitHub Actions 在 Ubuntu 上使用临时安装的 Chromium。

提交版本变更时，需同步维护 `package.json`、`package-lock.json`、`src/main.js`、`CHANGELOG.md` 和根目录 `JHS.user.js`。`npm run check` 会验证稳定版本格式、版本一致性和发布说明。

用户可见功能或版本变化时，同时更新本页和 [Sleazy Fork 中文介绍](docs/sleazyfork.zh-CN.md)。商店介绍以该文件为源，通过 [Raw 地址](https://raw.githubusercontent.com/Teamper/JHS/main/docs/sleazyfork.zh-CN.md) 同步。

## 质量门禁

完整发布门禁为 `npm run check:release`，包括：

- 单元测试、数据迁移、备份兼容、凭证、状态恢复和撤销回归。
- 类型检查、架构边界、第三方集成、产物大小与性能预算。
- 源码和产物语法、版本一致性、插件注册、主题对比度及键盘/ARIA 审计。
- 固定页面样本上的浏览器交互、启动性能和桌面/移动端视觉回归。

CI 还会重新构建并检查根目录 `JHS.user.js` 是否与已提交文件一致。自动测试使用固定页面样本和隔离的第三方服务，不会提交真实云盘任务。

可在浏览器控制台查看启动诊断：

```js
pluginManager.getStartupReport()
pluginManager.getTimings().sort((a, b) => b.elapsed - a.elapsed)
```

`readyMs` 表示脚本开始执行到即时插件完成的耗时，不包含 `@require` 资源下载和浏览器解析时间；`pending-idle` 表示任务已离开首屏关键路径，正在等待浏览器空闲时段执行。

## 发布方式

- PR 和 `main` push 均执行 Node 20 兼容检查、Node 22 完整检查、浏览器/视觉回归及构建产物同步检查。
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

在原设备中导出本地备份或上传 WebDAV 备份，再在新设备中导入或恢复。WebDAV 连接配置和云盘授权不会随备份迁移，需在新设备重新配置或登录；目标设备已有配置和凭证会保留。

</details>

<details>
<summary>如何反馈问题</summary>

前往 [GitHub Issues](https://github.com/Teamper/JHS/issues)，说明复现步骤、目标站点、脚本版本和控制台错误。请勿提交账号、Cookie、WebDAV 密码或云盘凭据。

</details>

## 许可

用户脚本元数据声明为 [MIT](src/main.js)。第三方网站、接口和脚本依赖分别受其自身条款与许可证约束。
