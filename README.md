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

`npm run check` 执行源码语法检查、回归门禁（39 插件、20 功能范围）和产物语法校验。

推送后 GitHub Actions 自动构建 `JHS.user.js` 并提交回仓库。

## 版本流

- `main`: 正式发布。CI 自动构建产物、创建 tag、发布 GitHub Release。
- `dev`: 预览版。CI 上传 `JHS-dev.user.js` artifact。

## Roadmap

- ~~**v4.4.0** 外部站点请求治理：熔断、限流、快速失败、本地服务 ping 缓存、站点健康状态、`@connect` 域名收敛~~ ✅
- ~~**v4.5.0** 移动端基础适配：`mobileMode`、插件移动端降级、底部操作栏、弹窗自适应、表格横滚、Android 优先支持（iOS 实验性）~~ ✅
- **v4.6.0** 移动端轻量模式：新作品中心移动版、磁力评分移动版、状态操作 Bottom Sheet、移动端设置页、图片懒加载
- **v4.7.0** 跨端数据同步：WebDAV 一键同步、移动端快照、简化差异预览、PC / 手机数据一致性
- **v4.8.1** 修复 123 云盘离线提交 MethodNotAllowed；**v4.8.0** 长期维护版：移动端安装文档、兼容矩阵、权限收敛、默认配置优化、问题诊断入口

## 变更日志

见 [CHANGELOG.md](CHANGELOG.md)。Release Notes 由 CI 从 CHANGELOG 自动生成。
