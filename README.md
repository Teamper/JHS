# JHS

JHS 是面向 JavDB / JavBus 等站点的油猴脚本，提供收藏、屏蔽、标记已下载、演员黑名单、新作品检测、磁力搜索、123 云盘离线导入、WebDAV 备份、统计仪表盘等功能。

## 安装

- 正式版: <https://github.com/Yaoser-Archive/JHS/releases/latest/download/JHS.user.js>
- 源码: <https://github.com/Yaoser-Archive/JHS>

`@downloadURL` 指向最新 GitHub Release，`@updateURL` 指向 `main` 分支的 `JHS.user.js`。

## 开发

源码在 `src/`，CI 负责构建和发布。本地只需验证：

```bash
npm ci
npm run check
```

`npm run check` 执行源码语法检查、回归门禁（39 插件、16 功能范围）和产物语法校验。

推送后 GitHub Actions 自动构建 `JHS.user.js` 并提交回仓库。

## 版本流

- `main`: 正式发布。CI 自动构建产物、创建 tag、发布 GitHub Release。
- `dev`: 预览版。CI 上传 `JHS-dev.user.js` artifact。

## Roadmap

- 新作品中心 + 磁力评分
- WebDAV 差异同步 + 数据恢复
- 插件开关中心 + 性能诊断面板

## 变更日志

见 [CHANGELOG.md](CHANGELOG.md)。Release Notes 由 CI 从 CHANGELOG 自动生成。
