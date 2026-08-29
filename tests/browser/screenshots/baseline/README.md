# Visual regression baselines

视觉回归是真实 PNG diff：toHaveScreenshot() 会与提交的基线逐像素比较
（maxDiffPixelRatio: 0.02），不再只是“能截出一张图”。

基线固定使用两个确定性 viewport project：`desktop-wide`（1440px）与
`mobile`（390px）。snapshotPathTemplate 带 `win32` / `linux` 平台后缀，
避免 Windows 与 Linux 字体、栅格化和系统布局差异互相污染。

生成/更新当前平台基线（视觉模式始终使用 package-lock 锁定的 Chromium）：

    cd tests/browser
    npm ci
    npx playwright install chromium --with-deps
    JHS_VISUAL_REGRESSION=1 npx playwright test specs/visual-regression.spec.js --update-snapshots

Windows 与 Ubuntu 24.04 的基线必须分别生成并提交；Linux 基线应在与 CI
相同的 Ubuntu 24.04 环境生成。禁止拿一个平台生成的 PNG 覆盖另一平台。

门禁命令（根目录）：

    npm run check:visual

普通 check:browser 默认跳过视觉回归；只有 `npm run check:visual`
（内部显式设置 JHS_VISUAL_REGRESSION=1）才与已提交基线做真实 diff。
基线 PNG 生成后作为普通文件提交。
