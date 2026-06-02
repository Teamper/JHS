# JHS-YA Development Guide

## Mobile Development Rules

### Dialog Sizing
- All `layer.open` calls MUST use `utils.getResponsiveArea(desktopFallback)` for the `area` property
- NEVER use raw arrays like `["50%", "70%"]` — they won't go fullscreen on mobile
- NEVER use `utils.getDefaultArea()` directly — it doesn't check mobile mode

### Overflow Prevention
- Mobile CSS MUST include `html { overflow-x: hidden; }` and `body { overflow-x: hidden; }`
- User-configurable percentage widths (e.g., `containerWidth`) MUST be capped at 100% on mobile
- Fixed-width inline styles must be audited for mobile overflow (e.g., 300px+200px+200px = 700px on a 375px screen)

### Bottom Bar Proxy Pattern
- The mobile bottom bar triggers clicks by element ID (e.g., `$(#filterBtn).click()`)
- Buttons referenced by the bottom bar MUST remain in the DOM on mobile
- Use CSS `display: none !important` to hide redundant buttons — NEVER skip creation via JS

### Safe Area (iPhone Notch/Dynamic Island)
- Fullscreen dialog title bar needs `padding-top: calc(14px + env(safe-area-inset-top, 0px))`
- Close button needs `top: calc(8px + env(safe-area-inset-top, 0px))`
- Toast positioning needs `bottom: calc(80px + env(safe-area-inset-bottom, 0px))`

### Touch Targets
- All interactive elements need `min-height: 44px`
- Use specific button class selectors, NOT `a[class]` (too broad, affects inline links)

### Confirm Dialogs on Mobile
- `utils.q()` must center the dialog on mobile, not use mouse-position offset
- Touch event coordinates can be at screen edges, causing dialogs to render off-screen

## Build & Deploy
- Build: `node scripts/build.mjs`
- Version files: `package.json`, `src/main.js` (@version), `CHANGELOG.md`
