# 发布说明与候选发布

GitHub Release 正文来自本目录的版本说明。从 [模板](TEMPLATE.md) 起草，标题为 `# JHS <版本>`，开头明确比较版本。按**新增、修复、改进、升级说明、致谢**组织，省略空分类。

| 发行 | 比较基点 |
| --- | --- |
| 首个 RC | 上一个正式版本 |
| 后续 RC | 同系列上一个 RC |
| 正式版 | 上一个正式版本，包含已验收的 RC 变化 |

核对比较基点和目标的完整提交、祖先关系和真实差异。说明用户可感知的变化、触发条件和升级事项。核实 PR 或 Issue 再署名，区分直接代码贡献、手动适配和问题反馈。

```powershell
npm run release:notes:context -- --base v7.0.0-rc.2 --target HEAD --version 7.0.0-rc.3
npm run check:release:notes -- 7.0.0-rc.3
```

上下文报告保存在忽略目录。只有实际核对后才用 `--adopted-pr` 确认手动采纳的提交。仅修订已发布版本的正文时，走单独授权的 `notes-v<版本>-r<编号>` 标签工作流，它会校验原标签、附件、渠道和 Latest。

## 7.0 RC 候选与发布

RC 名称为 `JHS RC 7.0`，namespace 为 `https://github.com/Teamper/JHS/rc/7.0`。同系列从固定 RC 通道更新。切换到正式版时手动安装，切换前先保留可移植备份。

在已审查的干净源码提交上构建并冻结 RC3：

```powershell
npm run build:rc -- 7.0.0-rc.3
npm run check:rc:delivery -- dist/rc/7.0.0-rc.3/JHS-7.0.rc.user.js --freeze
```

RC 构建生成用户脚本、元数据、SHA256SUMS 和 release-manifest.json。同一版本的本地文件只有字节一致才复用。浏览器复验将 `JHS_TEST_CHANNEL` 设为 `rc`，并用 `JHS_TEST_BUNDLE_PATH` 指向冻结包。记录隔离 Tampermonkey 中的 RC 更新、失败更新、备份导入和本安装的凭证保留。保留常规 CI 与隔离候选测试的对应提交和结果。

获得发布授权后，推送指向 `develop` 源码提交的 `v7.0.0-rc.3` 标签。现有 RC 工作流运行 Node 20 和 `npm run check:rc`。完整源码检查、浏览器功能和 Windows 视觉是硬门禁。启动和串行性能按原阈值独立记录。通过后发布 prerelease，校验附件，再更新 [固定 RC 通道](https://github.com/Teamper/JHS/tree/rc-channel) 的脚本、元数据和清单。

## 失败与重试

标签指向固定源码，公开附件保持同一版本的原始字节。较高版本开始发布后，旧版本失去晋升通道的资格。公开文件若因 CDN 延迟暂时不一致，先核对通道分支和附件，再复验相同版本。

当 Node 20 和候选作业已通过、只有发布环节失败时，使用 `release-rc-retry` 保留验证过的候选。恢复标签为 `rc-publish-retry-版本-原运行ID`，指向发布工具修复提交。工作流核对原运行、RC 标签、源码 SHA 和四份文件后继续。
