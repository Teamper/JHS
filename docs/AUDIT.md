# JHS-YA 代码审计报告

> 版本：3.3.4-by yaoser | 日期：2026-05-16 | 文件：JHS-3.3.4.json（8628 行，~645KB）

## 一、安全性

### 1.1 XSS 注入风险（高）

约 50 处使用 `innerHTML` / `$().html()` / jQuery `html()` 直接插入外部数据，未转义：

| 行号 | 代码模式 | 数据来源 |
|------|----------|----------|
| 1311 | `this.preview.innerHTML = '<img src="${t}">'` | 外部图片 URL |
| 1604 | `n.innerHTML = e` | 用户提供内容 |
| 6716 | `$(".screen-container").html('<img src="${t}"...>')` | 外部 URL |
| 7335 | `t.innerHTML = ... ${e} ...` | 页面抓取数据 |

**建议：** 使用 `textContent` 赋值文本，用 `document.createElement` + `setAttribute` 构建元素，或先对数据做 `escapeHtml()` 转义。

### 1.2 凭据明文存储（中）

| 行号 | 问题 |
|------|------|
| 7297 | `localStorage.setItem(this.JHS_115_COOKIE, n)` — 115 网盘 Cookie 明文存储 |
| 2668 | `localStorage.getItem("token")` — 身份 Token 管理无加密 |
| 5322 | `Authorization: Basic ${btoa(username:password)}` — HTTP Basic Auth 可被中间人截获 |

**建议：** 对敏感数据做 AES 加密后再写 localStorage；WebDAV 尽量走 HTTPS。

### 1.3 弱随机数（低）

| 行号 | 问题 |
|------|------|
| 1026 | `Math.random().toString(36).substring(2)` 生成 multipart boundary |

**建议：** 改用 `crypto.getRandomValues()` 生成安全随机数。

### 1.4 空异常捕获（中）

| 行号 | 问题 |
|------|------|
| 8348 | `} catch (e) {}` — ping 本地服务失败时静默吞掉异常，无法排查连通性问题 |

**建议：** 至少输出 `console.error` 记录异常详情。

---

## 二、代码质量

### 2.1 超长函数

14 个函数超过 5000 字符，前 5 名：

| 行号 | 函数 | 字符数 | 原因 |
|------|------|--------|------|
| 5457 | `openSettingDialog` | ~36,000 | 内联完整设置页面 HTML 模板 |
| 5420 | `initCss` | ~9,100 | 内联完整 CSS 样式表 |
| 6407 | `addSvgBtn` | ~10,000 | 大量 SVG 内联 + 按钮生成逻辑 |
| 3671 | `loadTableData` | ~8,100 | 表格数据加载 + 渲染 |
| 8199 | `editActress` | ~7,900 | 演员编辑弹窗 |

**根因：** HTML 模板、CSS 样式、SVG 图标全部内联在 JS 中，和业务逻辑混在一起。

### 2.2 生产日志

- 23 处 `console.log`（含调试信息如 "扫码登录成功"、"解析出cookie"）
- 78 处 `console.error`
- ~50 处 `clog.log` / `clog.debug` 自定义日志

**建议：** 统一走 `clog` 系统，增加日志级别开关；生产环境关闭 debug 级别输出。

### 2.3 死代码

- 第 6643 行：注释掉的 HTML 片段 `<!-- <div class="movie-poster-container">... -->`
- 多处 CSS 注释标记（如 `/*position: initial !important;*/`）

### 2.4 硬编码 CSS

CSS 散落在 JS 模板字面量中（第 154-175 行、5420 行、8038 行等），修改样式需在混淆代码中定位，效率低。

---

## 三、可维护性

### 3.1 混淆变量名

原作者打包产物，50 个类名均为单/双字母：`z`、`J`、`Y`、`X`、`Q`、`ae`、`oe`、`re`...  
理解一个新功能需先反向推断该类的作用。

### 3.2 零注释

无 JSDoc、无函数说明。函数意图需读完其完整实现才能理解。

### 3.3 无测试

无任何自动化测试。依赖浏览器手动回归。36K 字符的 `openSettingDialog` 改动极易引入 bug。

### 3.4 无变更记录

版本号从 3.3.4 迭代，但无 CHANGELOG，不知道每次改了什么。

---

## 四、性能

| 问题 | 影响 |
|------|------|
| 36K 字符 HTML 模板一次性解析 | 内存压力，首屏加载慢 |
| 大量 `$().html()` 全量替换 DOM | 破坏事件监听器，触发完整重排 |
| `localStorage.getItem()` 高频调用无缓存 | 每次访问都读磁盘 I/O |
| 设置表单连续 20+ 次 `$("#id")` 查询 | 每次都遍历 DOM 树 |

---

## 五、依赖管理

9 个 CDN 依赖无版本锁定机制：

| 依赖 | 版本 | 风险 |
|------|------|------|
| `parallel_GM_xmlhttpRequest.js` | 无版本号（GreasyFork URL） | 作者随时可更新，可能引入不兼容变更 |
| jQuery、Tabulator、localforage 等 | 有版本号 | CDN 不可用则脚本完全失效 |

**建议：** 对关键依赖保留本地 fallback；`@require` 的 GreasyFork URL 加上具体版本 hash。

---

## 六、总结

| 维度 | 等级 | 关键问题 |
|------|------|----------|
| 安全性 | ⚠️ 中 | XSS（~50 处 innerHTML）、凭据明文 |
| 代码质量 | ⚠️ 差 | 超长函数、混淆命名、生产日志未清理 |
| 可维护性 | ❌ 差 | 单文件巨型、零注释、零测试 |
| 性能 | ⚠️ 中 | 巨型模板、DOM 全量替换、无缓存 |
| 依赖 | ⚠️ 中 | CDN 无锁版本、无 SRI |
