# JHS Android 离线预览

用内置样片体验 JHS 的海报墙、列表、排序、作品详情、状态操作和液态玻璃导航。安卓预览使用独立包名。

## 构建网页

在仓库根目录安装现有依赖，构建结果位于 `apps/android/www`。

```sh
npm ci
node apps/android/build.mjs
python -m http.server 4173 --bind 127.0.0.1 --directory apps/android/www
```

浏览器打开本机的 4173 端口。

## 构建安卓预览

在本机准备 Android SDK 与 JDK 后运行以下命令，随后在 Android Studio 打开生成的 `apps/android/android`。

```sh
npm ci --prefix apps/android
npm run android:add --prefix apps/android
```

再次构建用 `npm run android:sync --prefix apps/android`。构建读取的模块在 `build.mjs` 中逐个登记。
