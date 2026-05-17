# JHS

JHS-YA 是 Jav-鉴黄师个人维护版脚本，支持 JavDB / JavBus 页面增强，包含收藏、屏蔽、标记已下载、演员黑名单、收藏演员同步、新作品检测、评论增强、相关清单、WebDAV 数据备份、以图识图、字幕搜索等功能。

## 当前版本

- 当前发布脚本：`JHS.user.js`
- 当前版本：`3.7.0`
- 新增能力：磁力链接旁一键提交到 123 云盘离线下载，并提供授权、提交成功、失败与过期反馈。

## 文件结构

```text
JHS.user.js                         当前可安装脚本
CHANGELOG.md                        变更日志
AGENTS.md                           Codex/Agent 协作约束
archive/original/JAV-JHS-3.3.2.js   原版基线
archive/releases/JHS-3.4.1.js       历史维护版
archive/releases/JHS-3.6.0.js       3.7.0 之前的当前版
vendor/123pan-lixian/               123 云盘离线下载参考脚本
docs/                               审计、路线图和本地协作说明
```

## 123 云盘离线导入

1. 安装或更新 `JHS.user.js`。
2. 打开并登录 `https://www.123pan.com/`，脚本会自动捕获离线接口授权。
3. 回到 JavDB / JavBus 详情页，点击磁力旁的“123离线”按钮提交离线任务。

授权 token 仅保存在油猴脚本存储中，不写入仓库或日志。
