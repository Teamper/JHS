# JHS

JHS 是面向 JavDB / JavBus 等站点的油猴脚本，当前发布版为 `3.7.3`。

## 安装

- 正式版安装地址: <https://github.com/Yaoser-x/JHS/releases/latest/download/JHS.user.js>
- 源码地址: <https://github.com/Yaoser-x/JHS>

脚本的 `@updateURL` 指向 `main` 分支的 `JHS.user.js`，`@downloadURL` 指向最新 GitHub Release 附件。

## 版本流

- `main`: 正式发布分支。推送后 GitHub Actions 会读取 `JHS.user.js` 中的 `// @version`，创建对应 `vX.Y.Z` tag，并发布 GitHub Release。
- `dev`: 预览分支。推送后只上传 `JHS-dev.user.js` artifact，不创建 tag，不创建正式 Release。

## 3.7.3

- 123 离线任务提交成功后，会自动将当前影片标记为 JHS 已下载。

## 3.7.2

- 123 云盘授权同步入口改为 `yun.123pan.com`，在云盘页面自动读取并保存 `authorToken` / `userInfo.token`。
- JavDB / JavBus 点击 `123离线` 时不再自动打开或跳转 123 云盘；缺少授权或授权过期时仅提示登录或刷新 `yun.123pan.com`。

## 3.7.1

- 123 云盘页面会定时同步 `authorToken` / `userInfo.token`，并记录 token 来源与更新时间，不输出 token 明文。
- 123 离线接口返回 `401` 或 `token is expired` 时会清空旧授权，并提示重新打开或刷新 123pan。
- 外部网站入口默认只展示搜索按钮；点击“检测外部站点”后才请求第三方站点。
- GitHub 仓库仅保留发布必要文件: `JHS.user.js`、`README.md`、`.github/workflows/release.yml`。
