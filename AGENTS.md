# JHS-YA (鉴黄师) — AI 助手指令

## 项目定位

这是一个 **Tampermonkey 用户脚本**，增强 javdb.com / javbus.com 等 JAV 数据库网站的浏览体验。  
所有代码在**单文件** `JHS-*.json` 中（实际是 `.user.js`，扩展名为历史遗留）。

## 架构概要

- **插件系统**：`PluginManager`（类 `Y`，行 1659）管理所有插件，通过 `register()` → `processCss()` → `processPlugins()` 生命周期运行
- **基类**：`X`（行 1717），所有功能插件继承它，必须实现 `getName()`
- **持久化**：`StorageManager`（类 `z`，行 189）封装 localforage → IndexedDB，数据库名 `JAV-JHS`，store 名 `appData`
- **HTTP**：`gmHttp`（`GM_xmlhttpRequest` 封装），支持 GET/POST/并发下载
- **通知**：`show` 对象（Toast 弹窗），`clog` 对象（自定义控制台日志）

## 修改规范

### 文件操作
- **只修改 `JHS-*.json` 这一个文件**，不创建 src/、lib/ 等目录
- 修改后同步更新两处版本号：
  1. 第 4 行 `@version` 元数据
  2. 文件名重命名为 `JHS-新版本号.json`

### 依赖
- **不新增 CDN 依赖**（`@require` 列表保持稳定）
- 优先复用已有工具：
  - `utils.*` — DOM 操作、资源导入、定时器
  - `storageManager.*` — IndexedDB 读写
  - `show.*` — Toast 通知
  - `gmHttp.*` — 跨域 HTTP 请求
  - `clog.*` — 自定义日志

### 代码风格
- 新代码用**有意义的变量/函数名**，不沿袭原混淆单字母风格
- 关键函数加**简短 JSDoc**（一行即可）
- **不要写注释解释"做了什么"**，代码本身应清晰；只在行为有隐藏约束或容易误读时加注释

### 安全红线
- **禁止 `innerHTML` / `$().html()` 直接拼接外部数据**（API 返回值、页面抓取内容），必须先用 `textContent` 或创建 DOM 元素
- 凭证类数据存 localStorage 前应 AES 加密
- `Math.random()` 不能用于安全相关场景，用 `crypto.getRandomValues()`

### 函数长度
- 脚本性质决定允许偏长函数，但纯逻辑超过 200 行考虑拆分
- 内联 HTML/CSS 模板提取为独立变量，不要和业务逻辑混在一起

## 关键代码位置

| 内容 | 行号 |
|------|------|
| 用户脚本元数据（@name, @version, @match, @require, @connect） | 1-75 |
| StorageManager（IndexedDB 持久化） | 189-629 |
| API 签名 `jdSignature` | 633-638 |
| Utils（DOM/HTTP/定时器工具） | 700-1658 |
| PluginManager | 1659-1715 |
| BasePlugin `X` | 1717-1883 |
| 各功能插件 | 1885-8566 |
| 启动入口 | 8568-8628 |

## 修改后检查

- [ ] `@version` 已更新
- [ ] 文件名版本号已同步
- [ ] 无新增 `innerHTML` 拼接外部数据
- [ ] 无新增 CDN 依赖
- [ ] 无遗留 `console.log` 调试日志
