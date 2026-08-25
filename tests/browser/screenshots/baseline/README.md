# Visual regression baselines

视觉回归是真实 PNG diff：toHaveScreenshot() 会与提交的基线逐像素比较
（maxDiffPixelRatio: 0.02），不再只是“能截出一张图”。

生成/更新基线（需本地或 CI Chromium/Edge）：

    cd tests/browser
    JHS_VISUAL_REGRESSION=1 npx playwright test --update-snapshots

普通 CI 默认跳过视觉回归（opt-in），避免无基线时误报；基线生成后作为普通文件提交。
