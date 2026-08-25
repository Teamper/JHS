# Visual regression baselines

生成/更新基线（需本地或 CI Chromium）：

    cd tests/browser
    JHS_VISUAL_REGRESSION=1 npx playwright test --update-snapshots

普通 CI 默认跳过视觉回归（opt-in），避免无基线时误报。
