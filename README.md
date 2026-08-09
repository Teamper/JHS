<div align="center">

# JHS-YA（鉴黄师）

面向 JavDB、JavBus 的模块化 Tampermonkey 增强脚本

[![Version](https://img.shields.io/github/v/release/Yaoser-Archive/JHS?label=version)](https://github.com/Yaoser-Archive/JHS/releases/latest)
[![Userscript](https://img.shields.io/badge/Tampermonkey-userscript-f59e0b)](https://github.com/Yaoser-Archive/JHS/releases/latest/download/JHS.user.js)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-43853d)](package.json)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](src/main.js)

[安装正式版](https://github.com/Yaoser-Archive/JHS/releases/latest/download/JHS.user.js) · [查看更新记录](CHANGELOG.md) · [反馈问题](https://github.com/Yaoser-Archive/JHS/issues)

</div>

JHS-YA 将作品状态、演员收藏、新作追踪、外部检索、媒体预览、字幕搜索、云盘离线和数据备份整合到站点页面中。脚本以插件方式按页面加载，并针对桌面端和移动端提供对应交互。

> 本项目仅提供网页信息整理与效率增强能力。请遵守所在地法律、目标网站条款及第三方服务规则，并仅处理你有权访问的内容。

## 功能概览

| 分类 | 主要能力 |
| --- | --- |
| 状态管理 | 标记待鉴定、收藏、屏蔽、已下载、已观看；列表页状态展示、批量操作、历史记录与自动翻页 |
| 演员管理 | 收藏演员、演员黑名单、演员信息补充、收藏同步与已收藏演员高亮 |
| 新作追踪 | 定时检查已收藏演员的新作品，提供网格/列表视图、筛选、排序和分页 |
| 内容过滤 | 按演员、作品和自定义关键词过滤；支持在详情页划词加入屏蔽词 |
| 外部信息 | 聚合相关作品、评论、热播、Top 250、FC2 信息、预告片与外部站点入口 |
| 磁力辅助 | 磁力搜索、字幕标识、综合评分与高亮，支持 123 云盘离线任务 |
| 图片与视频 | 封面查看、截图预览、悬浮大图和预览视频，图片列表采用懒加载 |
| 字幕与翻译 | SubtitleCat 字幕搜索、标题翻译和相关快捷入口 |
| 数据工具 | 本地导入导出、恢复点、数据体检、WebDAV 备份与恢复 |
| 统计与诊断 | 使用统计、插件启停、启动耗时、外部请求状态和域名使用统计 |

## 支持范围

| 页面或站点 | 支持内容 |
| --- | --- |
| JavDB | 列表页、详情页、演员页、搜索页及主要管理功能 |
| JavBus | 列表页、详情页、图片/视频预览及主要状态功能 |
| 123 云盘 | 从作品磁力信息创建离线任务，并在 123 云盘页面完成对应流程 |
| JavTrailers | 预告片辅助页面 |
| SubtitleCat | 字幕搜索辅助页面 |

外部检索和媒体信息依赖第三方站点。目标站点改版、访问限制或地区网络差异，均可能使单项能力暂时不可用；核心状态数据不依赖这些外部结果。

## 安装

### 1. 准备用户脚本管理器

在浏览器中安装 Tampermonkey 或兼容的用户脚本管理器，并允许其运行用户脚本。

### 2. 安装 JHS-YA

点击 **[安装最新正式版](https://github.com/Yaoser-Archive/JHS/releases/latest/download/JHS.user.js)**，在用户脚本管理器中确认安装。

安装后的更新来源：

- `@downloadURL`：最新 GitHub Release 中的 `JHS.user.js`
- `@updateURL`：`main` 分支中的构建产物

### 3. 打开支持的站点

访问 JavDB 或 JavBus。脚本会根据站点和页面类型自动注册所需插件；可从页面中的 JHS 设置入口调整功能、任务间隔、显示方式和外部站点地址。

## 推荐使用流程

1. 在列表页用状态按钮快速筛选和标记作品。
2. 在详情页查看磁力评分、字幕、预览和外部信息，并记录收藏、下载或观看状态。
3. 收藏演员后，在“新作品”中执行同步和新作检查。
4. 在设置页按需配置关键词过滤、WebDAV、123 云盘及外部站点。
5. 重要数据变更前创建恢复点，或先导出本地备份。

移动端使用右下角 FAB 浮动菜单访问当前页面可用操作；状态操作、工具和设置按组展示。

## 数据、备份与隐私

- 作品状态、演员列表、设置、缓存和恢复点默认保存在浏览器 IndexedDB 数据库 `JAV-JHS` 中。
- 清理浏览器站点数据、重置用户脚本存储或更换浏览器环境，可能导致本地数据丢失；升级或迁移前建议先导出备份。
- WebDAV 仅在启用并配置后用于远程备份与恢复，请使用可信服务地址并妥善保管凭据。
- 外部搜索、翻译、字幕、预告片和云盘功能会按需请求对应第三方服务；可在插件管理或设置中关闭不需要的能力。
- 导入数据会先校验可接受的数据结构；执行覆盖性操作前仍建议创建恢复点。

## 项目结构

```text
src/
├─ main.js                 # UserScript 元数据与启动入口
├─ core/                   # 存储、HTTP、事件总线、日志和插件框架
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
   ├─ one-two-three/       # 123 云盘离线导入
   └─ stats/               # 统计仪表盘
scripts/                   # 构建、源码检查和回归门禁
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

插件继承 `BasePlugin`，通过 `getBean("PluginName")` 获取其他插件实例；持久化数据统一由 `StorageManager` 管理。

## 本地开发

环境要求：Node.js 20 或更高版本。

```bash
git clone https://github.com/Yaoser-Archive/JHS.git
cd JHS
npm ci
npm run check
```

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run build` | 从 `src/` 构建根目录和 `dist/` 下的用户脚本 |
| `npm run check` | 依次执行测试、构建、源码检查、回归门禁和产物语法检查 |
| `npm run test:watch` | 以监听模式运行测试 |

提交功能变更时，需同步维护 `package.json`、`src/main.js` 与 `CHANGELOG.md` 中的版本信息。构建脚本会校验三处版本一致性。

## 质量门禁

当前 `npm run check` 覆盖：

- Vitest 单元测试；
- 源文件 JavaScript 语法检查；
- 39 个插件、20 个功能范围和 21 项稳定发布检查；
- 生成产物语法检查；
- 用户脚本 620 KiB 体积上限。

可在浏览器控制台查看启动诊断：

```js
pluginManager.getStartupReport()
pluginManager.getTimings().sort((a, b) => b.elapsed - a.elapsed)
```

`readyMs` 表示脚本开始执行到即时插件完成的耗时，不包含 `@require` 资源下载和浏览器解析时间；`pending-idle` 表示任务已离开首屏关键路径，正在等待浏览器空闲时段执行。

## 发布方式

- `main`：正式发布分支。CI 构建产物、创建版本标签并发布 GitHub Release。
- `dev`：预览分支。CI 构建并上传 `JHS-dev.user.js` artifact。

正式版入口始终指向 [latest release](https://github.com/Yaoser-Archive/JHS/releases/latest)，历史变化见 [CHANGELOG.md](CHANGELOG.md)。

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

前往 [GitHub Issues](https://github.com/Yaoser-Archive/JHS/issues)，说明复现步骤、目标站点、脚本版本和控制台错误。请勿提交账号、Cookie、WebDAV 密码或云盘凭据。

</details>

## 许可

用户脚本元数据声明为 [MIT](src/main.js)。第三方网站、接口和脚本依赖分别受其自身条款与许可证约束。
