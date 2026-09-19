# ADR-011：Vendor Bridge

状态：Accepted

生产运行时只通过 Vendor Bridge 读取 `@require` 注入的 jQuery、Tabulator、layer、md5、Toastify、localforage 与 Viewer。禁止从 npm import 或打包第二份 Vendor。Bootstrap 统一验证依赖；测试可注入 stub 或 npm implementation。
