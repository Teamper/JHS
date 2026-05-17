# JHS

JHS 是面向 JavDB / JavBus 等站点的油猴脚本，当前发布版为 `3.7.1`。

## 安装

- 正式版安装地址: <https://github.com/Yaoser-x/JHS/releases/latest/download/JHS.user.js>
- 源码地址: <https://github.com/Yaoser-x/JHS>

脚本的 `@updateURL` 指向 `main` 分支的 `JHS.user.js`，`@downloadURL` 指向最新 GitHub Release 附件。

## 版本流

- `main`: 正式发布分支。推送后 GitHub Actions 会读取 `JHS.user.js` 中的 `// @version`，创建对应 `vX.Y.Z` tag，并发布 GitHub Release。
- `dev`: 预览分支。推送后只上传 `JHS-dev.user.js` artifact，不创建 tag，不创建正式 Release。

## 3.7.1

- 123 云盘页面会定时同步 `authorToken` / `userInfo.token`，并记录 token 来源与更新时间，不输出 token 明文。
- 123 离线接口返回 `401` 或 `token is expired` 时会清空旧授权，并提示重新打开或刷新 123pan。
- 外部网站入口默认只展示搜索按钮；点击“检测外部站点”后才请求第三方站点。
- GitHub 仓库仅保留发布必要文件: `JHS.user.js`、`README.md`、`.github/workflows/release.yml`。

