# Visual regression baselines

视觉回归是真实 PNG diff：toHaveScreenshot() 会与提交的基线逐像素比较
（maxDiffPixelRatio: 0.02），不再只是“能截出一张图”。

基线固定使用两个确定性 viewport project：`desktop-wide`（1440px）与
`mobile`（390px）。snapshotPathTemplate 不带平台后缀，保证 Linux CI 与本地
Chromium 结果一致。

生成/更新基线（需本地或 CI Chromium；用 CI 模式避免本地 Edge 字体差异）：

    cd tests/browser
    npm ci
    npx playwright install chromium --with-deps
    CI=1 JHS_VISUAL_REGRESSION=1 npx playwright test --update-snapshots

门禁命令（根目录）：

    npm run check:visual

普通 check:browser 默认跳过视觉回归；只有 `npm run check:visual`
（内部显式设置 JHS_VISUAL_REGRESSION=1）才与已提交基线做真实 diff。
基线 PNG 生成后作为普通文件提交。
