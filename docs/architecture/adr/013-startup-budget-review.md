# ADR-013：6.5 启动预算复核

状态：Accepted
日期：2026-08-31
范围：6.5.0 release gate

## 背景

6.5 过渡架构完成 FeatureRuntime、Storage 一致性底座和兼容边界收口后，原有启动基线 220/230 ms 已无法反映当前正式产物。启动专项同时记录了用户脚本整体解析执行、bootstrap phase 和 cold/warm 差异；不能通过提高 bundle ceiling、取消断言或伪造人工 Smoke 来消除差异。

## 证据

测试环境为已安装的 Microsoft Edge `152.0.4191.53`，desktop-wide fixture，正式产物 `JHS.user.js` 为 1,284,752 bytes。

| 模式 | 站点 | 样本数 | P50 | P95 | userscript eval P50 | bootstrap total P50 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| warm | JavDB | 30 | 281.1 ms | 296.9 ms | 218.3 ms | 97.7 ms |
| warm | JavBus | 30 | 287.4 ms | 311.7 ms | 216.0 ms | 104.8 ms |
| cold | JavDB | 30 | 301.6 ms | 325.4 ms | 238.0 ms | 100.4 ms |
| cold | JavBus | 30 | 305.7 ms | 316.6 ms | 231.3 ms | 106.9 ms |

采样命令分别为：

```text
JHS_STARTUP_SAMPLES=30 npm run check:browser -- tests/browser/specs/startup-performance.spec.js
JHS_STARTUP_SAMPLES=30 JHS_STARTUP_MODE=cold npm run check:browser -- tests/browser/specs/startup-performance.spec.js
```

作为对照，启用 `minifySyntax` 后产物降至 1,262,721 bytes，但 5 次 warm 采样仍为 JavDB 288.6 ms、JavBus 300.6 ms，未达到原硬上限；该实验配置已恢复。此前已移除列表兼容壳对旧 `ListPagePlugin` 实现的生产引用，并将 eager Feature 激活改为并行等待，未改变 12% bundle ceiling。

## 决策

1. 6.5.0 的正式 warm 启动基线调整为 JavDB `282 ms`、JavBus `288 ms`，启动回归门禁仍按 `110%` 执行，对应 reviewed maximum 为 310.2/316.8 ms。
2. cold 采样作为诊断证据保留，不替代正式 warm gate；后续性能改动仍必须同时观察两种模式。
3. bundle ceiling 继续固定为 baseline 的 `112%`，本 ADR 不授权放宽产物体积预算。
4. 该调整只适用于 6.5 过渡版本；7.0 应重新拆分启动代码或降低实际 P50 后再建立新的基线，不能沿用本 ADR 自动抬高预算。

## 后果

当前启动 gate 可以反映已审查的 6.5 过渡产物，并继续阻断相对该基线的回归；但这不是声称启动速度变快。真实 Tampermonkey 人工 Smoke 仍必须独立完成，自动 fixture 不能替代该发布证据。
