# ADR-011：Vendor Bridge

状态：Accepted

Userscript 由 `@require` 装载 jQuery、Tabulator、layer、md5、Toastify、localforage 与 Viewer，`src/platform/userscript/vendor-runtime.js` 在入口读入并校验。扩展和 Android WebView 在平台构建时提供依赖。Bootstrap 将已验证的依赖显式传给装配和页面能力。

Feature 通过 `DomUiService`、Dialog Port、Storage Port 和 HTTP Port 使用对应能力。React Native 使用自身控件，复用共享业务服务和可注入解析器。跨端入口见 [代码职责](../ownership.md)。
