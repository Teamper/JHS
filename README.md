# JHS

JHS 是面向 JavDB / JavBus 等站点的油猴脚本，当前发布版为 `3.7.7`。

## 安装

- 正式版安装地址: <https://github.com/Yaoser-x/JHS/releases/latest/download/JHS.user.js>
- 源码地址: <https://github.com/Yaoser-x/JHS>

脚本的 `@updateURL` 指向 `main` 分支的 `JHS.user.js`，`@downloadURL` 指向最新 GitHub Release 附件。

## 版本流

- `main`: 正式发布分支。推送后 GitHub Actions 会读取 `JHS.user.js` 中的 `// @version`，创建对应 `vX.Y.Z` tag，并发布 GitHub Release。
- `dev`: 预览分支。推送后只上传 `JHS-dev.user.js` artifact，不创建 tag，不创建正式 Release。

## 3.7.7

- 修复快捷键设置中关闭图片快捷键后，控制台切换和折叠分类快捷键也无法使用的问题。
- 修复演员收藏时名称为空不报错的问题。
- 修复多个异步点击处理器未捕获异常的问题。
- 修复 FC2 项目点击后 `$currentImage` 未清除导致快捷键可能操作到错误项目的问题。
- 修复演员页标签展开状态记忆使用过期 DOM 引用的问题。
- 修复封面按钮的外部站点链接在修改设置后不会更新、需要刷新页面的问题。

## 3.7.6

- 修复快速筛选"全部"按钮无法显示已标记项目的问题。

## 3.7.5

- 修复快速筛选无法显示已标记项目的问题：当设置中关闭了某类已鉴定内容的显示后，快速筛选按钮（已下载、已收藏、已观看）无法正确显示对应项目。

## 3.7.4

- 优化列表页首屏性能。

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
