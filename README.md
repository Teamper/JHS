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

## 功能概览

| 分类 | 主要能力 |
| --- | --- |
| 状态管理 | 收藏、已下载、已观看和主动屏蔽可独立组合；桌面使用 5+1 Quick Filter，支持待鉴定、屏蔽项及收藏未下载等智能视图，状态变化会精准同步到列表、详情和统计 |
| 演员管理 | 收藏演员、演员黑名单、演员信息补充、收藏同步与已收藏演员高亮 |
| 新作追踪 | 按规范化番号聚合演员新作，支持搜索、类别/VR/状态/决策筛选、多选状态、忽略、暂缓、恢复及“从新作列表移除” |
| 内容过滤 | 手动屏蔽、关键词、男演员和女演员规则组成 hard-hidden union，仅“屏蔽项”视图可见；自动过滤不会改变作品状态 |
| 外部信息 | 聚合相关作品、评论、热播、Top 250、FC2 信息、预告片与外部站点入口 |
| 磁力辅助 | Registry 驱动的多来源搜索、infohash 去重、字幕标识、综合评分与高亮；手动选择资源后由统一离线入口按云盘能力路由 |
| 图片与视频 | 多截图源顺序回退、分源缓存、封面查看、悬浮大图和预览视频 |
| 字幕与翻译 | SubtitleCat 字幕搜索、标题翻译和相关快捷入口 |
| 数据工具 | 本地/WebDAV 完整备份、迁移快照、数据体检、未来版本拒绝、崩溃可恢复状态事务和逐项撤销 |
| 统计与诊断 | 全库只读概览、当前页屏蔽项入口、6.4.0 起的 7/30 天活动趋势、日志覆盖范围、插件启动和外部请求诊断 |

## 支持范围

| 页面或站点 | 支持内容 |
| --- | --- |
| JavDB | 列表页、详情页、演员页、搜索页及主要管理功能；兼容层会隐藏已确认的宿主广告容器 |
| JavBus | 列表页、详情页、图片/视频预览及主要状态功能 |
| 123 云盘 | 默认启用并支持 Magnet；在 123 云盘页面同步授权，未同步时会在统一服务选择器中显示明确状态 |
| 115 | 默认关闭并支持 Magnet / ED2K；登录状态按最近提交结果缓存，提供离线历史、详情/列表增量匹配、播放和确认后重命名 |
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

移动端列表页使用右下角 FAB 的六个固定入口访问开始鉴定、新作品、黑名单、排序、筛选和设置；其中筛选是桌面 Quick Filter 的紧凑等价入口。详情页状态操作、工具和设置仍按组展示。

## 数据、备份与隐私

- 作品状态、演员列表、活动日志、离线历史、新作决策、设置和恢复点默认保存在浏览器 IndexedDB 数据库 `JAV-JHS` 中。
- 6.4.0 首次升级会创建一次 data v2 迁移快照；来自更高数据版本的备份会在写入前拒绝，避免旧脚本猜测未来结构。
- 活动趋势不伪造升级前历史，永久标明仅统计 6.4.0 及之后的操作；发生安全硬上限裁剪时会显示实际覆盖起点。
- 清理浏览器站点数据、重置用户脚本存储或更换浏览器环境，可能导致本地数据丢失；升级或迁移前建议先导出备份。
- WebDAV 仅在启用并配置后用于远程备份与恢复，请使用可信服务地址并妥善保管凭据。
- 外部搜索、翻译、字幕、预告片和云盘功能会按需请求对应第三方服务；可在插件管理或设置中关闭不需要的能力。
- 导入数据会先校验可接受的数据结构；执行覆盖性操作前仍建议创建恢复点。

## 项目结构

```text
src/
├─ main.js                 # UserScript 元数据与启动入口
├─ core/                   # 存储、HTTP、事件总线、日志和插件框架
├─ parsers/                # 可独立测试的第三方页面解析边界
└─ plugins/                # 按业务域拆分的功能插件
   ├─ status/              # 状态、导航、列表与详情页增强
   ├─ blacklist/           # 黑名单与关键词过滤
   ├─ favorite/            # 演员收藏
   ├─ new-video/           # 新作品面板与后台任务
   ├─ external-search/     # 外部信息和磁力聚合
   ├─ image-viewer/        # 图片与视频预览
   ├─ backup/              # 设置、备份、恢复和诊断
   ├─ avatar/              # 演员信息与以图识图
   ├─ translate/           # 翻译
   ├─ subtitle/            # 字幕搜索
   ├─ one-two-three/       # 123 云盘授权、Magnet 解析与任务 API
   ├─ one-one-five/        # 115 Client、增量匹配、播放与确认重命名
   ├─ offline/             # 统一离线 Provider、可用性与提交编排
   └─ stats/               # 统计仪表盘
scripts/                   # 构建、版本发布契约、源码检查和回归门禁
tests/                     # Vitest 单元测试
```

核心运行关系：

```text
src/main.js
  └─ PluginManager
      ├─ 根据站点注册插件
      ├─ 汇总并注入插件样式
      ├─ 执行首屏即时任务
      └─ 在浏览器空闲阶段执行后台任务
```

插件继承 `BasePlugin`，通过 `getBean("PluginName")` 获取其他插件实例；作品状态写入统一经 `StateService` 事务协调，`StorageManager` 保留存储和旧 API 兼容职责。构建器以 `src/main.js` 为唯一发布入口，将 core、parser 与 plugin 模块按显式清单送入 esbuild，输出保留空白和语义类名的 IIFE UserScript。

## 本地开发

环境要求：Node.js 20 或更高版本。

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
| `npm run check` | 执行测试、构建、源码检查、发布契约、回归/对比度/UI 审计和产物语法检查 |
| `npm run test:watch` | 以监听模式运行测试 |

提交版本变更时，需同步维护 `package.json`、`package-lock.json`、`src/main.js`、`CHANGELOG.md` 和根目录 `JHS.user.js`。`npm run check` 会验证稳定版本格式、版本一致性和发布说明。

## 质量门禁

当前 `npm run check` 覆盖：

- Vitest 单元测试；
- data v2 迁移、future-version 零写入拒绝、状态事务恢复、部分撤销、事件去重、Provider capability 和活动保留行为测试；
- 源文件 JavaScript 语法检查；
- package/lockfile/元数据/CHANGELOG/构建产物的 release-contract；
- 插件注册完整性、主要功能范围、Quick Filter 与宿主兼容规则的静态回归检查；
- 浅色/深色 WCAG AA 对比度和 UI 生命周期、键盘、ARIA 一致性审计；
- 生成产物语法检查；
- Sleazy Fork 可读代码门禁：构建产物不压缩、不混淆并严格小于 2 MB。

可在浏览器控制台查看启动诊断：

```js
pluginManager.getStartupReport()
pluginManager.getTimings().sort((a, b) => b.elapsed - a.elapsed)
```

`readyMs` 表示脚本开始执行到即时插件完成的耗时，不包含 `@require` 资源下载和浏览器解析时间；`pending-idle` 表示任务已离开首屏关键路径，正在等待浏览器空闲时段执行。

## 发布方式

- PR 和 `main` push 均须通过 Node 20 兼容检查、Node 22 完整门禁及根目录构建产物同步检查。
- `package.json` 的稳定版 `version` 是正式发布信号；`main` 检测到版本严格递增后，CI 自动验证版本契约、创建 annotated `vX.Y.Z` 标签、提取 CHANGELOG 说明并发布 `JHS.user.js`。
- 未修改版本号的提交不会创建 Release；版本回退、指向其他提交的同名标签以及已有 Release 均会阻止发布，历史版本和资产不会被覆盖。
- `workflow_dispatch` 仅用于失败发布的人工恢复，仍执行完整检查并遵守相同的标签和 Release 不可变约束。

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

在原设备中导出本地备份或上传 WebDAV 备份，再在新设备中导入或恢复。覆盖前建议在新设备先创建恢复点。

</details>

<details>
<summary>如何反馈问题</summary>

前往 [GitHub Issues](https://github.com/Teamper/JHS/issues)，说明复现步骤、目标站点、脚本版本和控制台错误。请勿提交账号、Cookie、WebDAV 密码或云盘凭据。

</details>

## 许可

用户脚本元数据声明为 [MIT](src/main.js)。第三方网站、接口和脚本依赖分别受其自身条款与许可证约束。
