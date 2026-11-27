# JHS Android 离线预览

用 40 部内置样片体验发现、追新、片库和共享作品详情。标记、备注、清单和偏好保存在当前预览的本地存储。Android 使用独立包名 `io.github.teamper.jhs.preview`。

样片用于离线界面与流程回归。在线目录、账号和同步由 [Android / iOS 原生验收工程](../mobile/README.md) 提供。

## 构建网页

在仓库根目录安装现有依赖，构建结果位于 `apps/android/www`。

```sh
npm ci
npm ci --prefix apps/android
node apps/android/build.mjs
python -m http.server 4173 --bind 127.0.0.1 --directory apps/android/www
```

浏览器打开本机的 4173 端口。追加 `?mode=wireframe` 可以切到灰阶流程原型。产品定义、状态表、线框和回归任务见 [产品基线](design/product.md)。

## 构建安卓预览

在本机准备 Android SDK 与 JDK 后运行以下命令，随后在 Android Studio 打开生成的 `apps/android/android`。

```sh
npm ci --prefix apps/android
npm run android:add --prefix apps/android
```

再次构建用 `npm run android:sync --prefix apps/android`。构建读取的模块在 `build.mjs` 中逐个登记。

## 回归验证

```sh
npm --prefix apps/android test
npm ci --prefix tests/browser
node apps/android/preview.browser.mjs
```

浏览器验收使用已安装的 Chrome。可通过 `JHS_CHROME_PATH` 指定浏览器路径。截图保存在仓库的 `output/jhs-android/preview-evidence`。

设备验收使用样片流程。检查发现页返回时的滚动位置、追新的暂缓和撤销、片库批量操作及重启后备注保留。再检查窄屏、软键盘和系统返回、横竖屏、画廊缩放及 TalkBack 导航。安装与覆盖更新使用同一测试签名。
