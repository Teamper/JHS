import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../../tests/browser/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../build/web/', import.meta.url));
const evidence = fileURLToPath(new URL('../../../output/playwright/jhs-mobile/', import.meta.url));
const legacyReader = await readFile(new URL('../modules/jhs-device/android/src/main/assets/jhs-read-legacy.html', import.meta.url));
const chrome = process.env.JHS_CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.ttf': 'font/ttf', '.png': 'image/png', '.mp4': 'video/mp4' };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  if (pathname === '/jhs-read-legacy') return response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(legacyReader);
  const file = path.resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try {
    const asset = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
    response.end(asset);
  } catch { response.writeHead(404).end(); }
});

await mkdir(evidence, { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

async function waitForNavigationLens(page) {
  await page.waitForFunction(() => {
    const nav = document.querySelector('[role="tablist"][aria-label="主导航"]');
    if (!nav || !nav.getBoundingClientRect().width) return true;
    const selected = nav.querySelector('[role="tab"][aria-selected="true"]');
    const lens = nav.querySelector('[data-testid="navigation-lens"]');
    if (!selected || !lens) return false;
    const center = node => {
      const rect = node.getBoundingClientRect();
      return rect.x + rect.width / 2;
    };
    if (Math.abs(center(selected) - center(lens)) >= 1) {
      delete lens.dataset.settledFrames;
      return false;
    }
    const frames = Number(lens.dataset.settledFrames ?? 0) + 1;
    if (frames < 8) { lens.dataset.settledFrames = String(frames); return false; }
    delete lens.dataset.settledFrames;
    return true;
  });
}

async function captureSettled(page, name) {
  await waitForNavigationLens(page);
  await page.screenshot({ path: path.join(evidence, `${name}.png`), animations: 'disabled' });
}

async function checkProductTasks(page, url) {
  page.setDefaultTimeout(12_000);
  const button = name => page.getByRole('button', { name, exact: true });
  const tab = name => page.getByRole('tab', { name, exact: true });
  const text = name => page.getByText(name, { exact: true });
  const dialog = name => page.getByRole('dialog', { name });
  const choice = (root, name) => root.getByRole('button', { name, exact: true, pressed: true });
  const capture = name => captureSettled(page, name);
  await page.goto(url);
  await button('沿河的午后').waitFor();
  await button('分类').click();
  await dialog('作品分类').getByRole('button', { name: '有码', exact: true }).click();
  await button('有码').waitFor();
  await button('标签筛选').click();
  let filters = dialog('标签筛选');
  await filters.getByRole('button', { name: '风景' }).click();
  await capture('discover-filters');
  await filters.getByRole('button', { name: '应用' }).click();
  await button('标签筛选 1').waitFor();
  await button('标签筛选 1').click();
  filters = dialog('标签筛选');
  await filters.getByRole('button', { name: '旅程' }).click();
  await filters.getByRole('button', { name: '取消' }).click();
  await button('标签筛选 1').click();
  await choice(filters, '风景').waitFor();
  await filters.getByRole('button', { name: '清除标签' }).click();
  await filters.getByRole('button', { name: '应用' }).click();
  await button('排序').click();
  let sort = dialog('作品排序');
  await sort.getByRole('button', { name: '评分优先' }).click();
  await sort.getByRole('button', { name: '取消' }).click();
  await button('排序').click();
  sort = dialog('作品排序');
  await choice(sort, '来源顺序').waitFor();
  await sort.getByRole('button', { name: '发行日期' }).click();
  await sort.getByRole('button', { name: '应用' }).click();
  await button('发行日期').waitFor();
  await tab('榜单').click();
  await button('高分').click();
  await dialog('榜单类型').getByRole('button', { name: '演员', exact: true }).click();
  await button('周榜').click();
  await dialog('榜单周期').getByRole('button', { name: '日榜', exact: true }).click();
  await text('演员榜单').waitFor();
  await button('林夏').waitFor();
  await tab('最新').click();

  const search = page.getByLabel('搜索番号、标题或演员');
  await search.fill('沿河的午后');
  await button('沿河的午后').click();
  await button('收藏').click();
  await text('已保存片库标记').waitFor();
  await button('我的评分').click();
  await dialog('我的评分').getByRole('button', { name: '4 星', exact: true }).click();
  await button('我的评分 4 星').waitFor();
  await button('林夏').click();
  await text('演员作品').waitFor();
  await button('保存演员资料').click();
  await text('演员资料已保存').waitFor();
  await button('取消收藏演员').waitFor();
  await capture('actor-works');
  await button('返回').click();
  await text('演员资料已保存').waitFor({ state: 'hidden' });
  await text('相关作品').waitFor();
  await button('小镇的夏天').scrollIntoViewIfNeeded();
  const workScroll = page.locator('[data-testid="work-scroll"]:visible');
  const before = await workScroll.evaluate(list => list.scrollTop);
  assert.ok(before > 100, 'related work was reached by scrolling the detail');
  await capture('detail-related');
  await button('小镇的夏天').click();
  await text('小镇的夏天').filter({ visible: true }).waitFor();
  await button('返回').click();
  await text('相关作品').waitFor();
  await page.waitForFunction(offset => [...document.querySelectorAll('[data-testid="work-scroll"]')]
    .some(list => list.getBoundingClientRect().width > 0 && Math.abs(list.scrollTop - offset) <= 2), before);
  await button('返回').click();
  assert.equal(await search.inputValue(), '沿河的午后');
  await button('发行日期').waitFor();
  await button('沿河的午后').waitFor();
  await tab('我的').click();
  await button('账号连接').click();
  await text('当前使用内置样片，真实账号连接请在在线版中使用。').waitFor();
  await capture('accounts-preview');
  await button('返回').click();
  await button('云盘任务').click();
  await text('账号会话可用后即可查看真实云盘任务。').waitFor();
  await capture('cloud-preview');
  await button('返回').click();
  await button('演员收藏').click();
  await button('林夏').waitFor();
  await capture('favorite-actors');
  await button('返回').click();
  await button('模拟发现页读取失败').click();
  await tab('发现').click();
  await text('样片读取失败，请重试。').waitFor();
  await button('沿河的午后').waitFor();
  await button('重试').click();
  await text('样片读取失败，请重试。').waitFor({ state: 'hidden' });
  assert.equal(await search.inputValue(), '沿河的午后');
  await search.fill('');
  await text('继续浏览').waitFor();
  await button('有码').waitFor();
  await search.fill('江遥');
  await tab('演员').click();
  await button('江遥').click();
  await button('收藏演员').click();
  await button('取消收藏演员').click();
  await button('收藏演员').waitFor();
  await button('返回').click();

  await tab('追新').click();
  await button('筛选演员').click();
  let actorFilter = dialog('筛选演员');
  await actorFilter.getByRole('button', { name: '林夏' }).click();
  await actorFilter.getByRole('button', { name: '应用' }).click();
  await button('林夏').click();
  actorFilter = dialog('筛选演员');
  await actorFilter.getByRole('button', { name: '许舟' }).click();
  await capture('follow-actor-filter');
  await actorFilter.getByRole('button', { name: '取消' }).click();
  await button('林夏').waitFor();
  await button('沿河的午后').waitFor();
  await button('处理完成').first().click();
  await button('沿河的午后').waitFor({ state: 'hidden' });
  const second = page.getByTestId('follow-JHS-002');
  await second.getByRole('button', { name: '处理完成' }).click();
  await second.waitFor({ state: 'hidden' });
  await button('暂缓一天').first().click();
  await tab('暂缓').click();
  await button('恢复待办').waitFor();
  await button('撤销').click();
  await button('恢复待办').waitFor({ state: 'hidden' });
  await tab('已处理').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="button"]')]
    .filter(button => button.getAttribute('aria-label') === '恢复待办').length === 2);

  await tab('片库').click();
  await button('收藏').click();
  await button('筛选').click();
  let libraryFilters = dialog('片库筛选');
  await libraryFilters.getByRole('button', { name: '年度样片' }).click();
  await libraryFilters.getByRole('button', { name: '取消' }).click();
  await button('筛选').click();
  libraryFilters = dialog('片库筛选');
  await choice(libraryFilters, '全部清单').waitFor();
  await libraryFilters.getByRole('button', { name: '周末放映' }).click();
  await capture('library-filters');
  await libraryFilters.getByRole('button', { name: '应用' }).click();
  await text('2 部作品').waitFor();
  const librarySearch = page.getByLabel('搜索片库');
  await librarySearch.fill('沿河');
  await text('1 部作品').waitFor();
  await button('沿河的午后').click();
  await button('编辑备注').click();
  await page.getByLabel('作品备注').fill('周末回看');
  await button('保存备注').click();
  await text('周末回看').waitFor();
  await button('返回').click();
  assert.equal(await librarySearch.inputValue(), '沿河');
  await librarySearch.fill('');
  await text('2 部作品').waitFor();
  async function selectPair() {
    await button('多选').click();
    await button('沿河的午后').click();
    await button('走进傍晚的山林').click();
    await button('批量标记').click();
  }
  await selectPair();
  await button('标为已看').click();
  await text('已更新 2 部作品').waitFor();
  await button('已看').click();
  await text('2 部作品').waitFor();
  await button('撤销').click();
  await text('0 部作品').waitFor();
  await button('已看').click();
  await text('2 部作品').waitFor();

  await selectPair();
  await button('加入清单').click();
  await dialog('加入清单').getByRole('button', { name: '以后再看' }).click();
  await text('已加入 2 部作品').waitFor();
  await button('周末放映').click();
  await dialog('片库筛选').getByRole('button', { name: '以后再看' }).click();
  await button('应用').click();
  await text('2 部作品').waitFor();
  await selectPair();
  await button('移出当前清单').click();
  await text('移出选中的 2 部作品？').waitFor();
  await button('确认移出').click();
  await text('0 部作品').waitFor();
  await button('撤销').click();
  await text('2 部作品').waitFor();
  await selectPair();
  await button('移出片库').click();
  await text('移出选中的 2 部作品？').waitFor();
  await capture('library-remove');
  await button('确认移出').click();
  await text('0 部作品').waitFor();
  await button('撤销').click();
  await text('2 部作品').waitFor();
  console.log('Chrome 产品任务：发现搜索收藏和原位重试，追新演员筛选、连续处理和暂缓撤销，片库备注、多选已看、清单与整批移出均已通过。');
}

let browser;
try {
  const address = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(chrome ? { executablePath: chrome } : { channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error(error);
  });
  const capture = name => captureSettled(page, name);
  const button = name => page.getByRole('button', { name, exact: true });
  const tab = name => page.getByRole('tab', { name, exact: true });
  const decodeCover = control => control.locator('img').first().evaluate(image => image.decode());
  const waitForIndicator = label => page.waitForFunction(name => {
    const selected = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].find(tab => tab.getAttribute('aria-label') === name);
    const indicator = selected?.closest('[role="tablist"]')?.querySelector('[data-testid="segmented-indicator"]');
    if (!selected || !indicator) return false;
    const slot = selected.getBoundingClientRect();
    const slider = indicator.getBoundingClientRect();
    if (!slot.width || Math.abs(slot.x - slider.x) >= 1 || Math.abs(slot.width - slider.width) >= 1) {
      delete selected.dataset.indicatorFrames;
      return false;
    }
    const frames = Number(selected.dataset.indicatorFrames || 0) + 1;
    if (frames < 8) { selected.dataset.indicatorFrames = String(frames); return false; }
    delete selected.dataset.indicatorFrames;
    return true;
  }, label);
  async function drag(from, to) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
  await page.goto(address);
  await button('沿河的午后').waitFor();
  const nav = page.getByRole('tablist', { name: '主导航' });
  const navBox = await nav.boundingBox();
  assert.ok(navBox && navBox.height === 64 && navBox.x >= 16 && navBox.y + navBox.height <= 832);
  for (const label of ['发现', '追新', '片库', '我的']) {
    const box = await tab(label).boundingBox();
    assert.ok(box && box.width >= 48 && box.height >= 48, `${label} hit target`);
    assert.ok(await tab(label).evaluate(node => {
      const text = node.querySelector('[dir]');
      return !text || text.scrollWidth <= text.clientWidth;
    }), `${label} caption fits`);
  }
  await capture('discover');
  const firstTab = await tab('发现').boundingBox();
  const secondTab = await tab('追新').boundingBox();
  assert.ok(firstTab && secondTab);
  await page.mouse.move(firstTab.x + firstTab.width / 2, firstTab.y + firstTab.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondTab.x + secondTab.width / 2, secondTab.y + secondTab.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('tab', { name: '追新', exact: true, selected: true }).waitFor({ timeout: 8000 });
  await page.getByLabel('搜索追新作品或演员').waitFor();
  await tab('发现').click();
  await page.getByRole('tab', { name: '发现', exact: true, selected: true }).waitFor();
  const search = page.getByLabel('搜索番号、标题或演员');
  const discoverList = page.getByTestId('discover-list');
  await search.fill('JHS-0');
  await page.getByText('搜索结果', { exact: true }).waitFor();
  await discoverList.evaluate(list => { list.scrollTop = 608; });
  await button('北窗').scrollIntoViewIfNeeded();
  const anchor = await discoverList.evaluate(list => list.scrollTop);
  assert.ok(anchor > 200, 'opened a work from a scrolled catalog');
  await button('北窗').click();
  await page.getByText('作品详情', { exact: true }).waitFor();
  await decodeCover(button('查看封面'));
  await capture('detail');
  await button('收藏').click();
  await page.getByText('已保存片库标记', { exact: true }).waitFor();
  await button('撤销').click();
  await page.getByText('已撤销', { exact: true }).waitFor();
  await button('编辑备注').click();
  await page.getByRole('dialog', { name: '编辑备注' }).waitFor();
  await capture('detail-remark');
  await page.getByLabel('作品备注').fill('这段草稿应被丢弃');
  await button('取消').click();
  await button('编辑备注').click();
  assert.equal(await page.getByLabel('作品备注').inputValue(), '');
  await page.getByLabel('作品备注').fill('样片本地备注');
  await button('保存备注').click();
  await page.getByText('样片本地备注', { exact: true }).waitFor();

  await tab('媒体').click();
  await waitForIndicator('媒体');
  await button('播放预告样片').scrollIntoViewIfNeeded();
  await decodeCover(button('播放预告样片'));
  await decodeCover(button('查看第 1 张剧照'));
  await capture('detail-media');
  await button('播放预告样片').click();
  await page.locator('video').waitFor();
  await page.waitForFunction(() => (document.querySelector('video')?.readyState ?? 0) >= 2);
  await button('收起预告').click();
  await page.locator('video').waitFor({ state: 'detached' });
  await button('查看第 1 张剧照').click();
  const gallery = page.getByTestId('gallery-viewport');
  await gallery.waitFor();
  const frame = await gallery.boundingBox();
  assert.ok(frame);
  const x = Math.round(frame.x + frame.width / 2);
  const y = Math.round(frame.y + frame.height / 2);
  const waitForScale = zoomed => page.waitForFunction(zoom => {
    const view = document.querySelector('[data-testid="gallery-transform"]');
    if (!view) return false;
    const scale = new DOMMatrixReadOnly(getComputedStyle(view).transform).a;
    return zoom ? scale > 1.65 : Math.abs(scale - 1) < 0.005;
  }, zoomed, { timeout: 8000 });
  await page.mouse.dblclick(x, y);
  await waitForScale(true);
  await capture('gallery-zoom');
  await page.mouse.dblclick(x, y);
  await waitForScale(false);
  const touch = await page.context().newCDPSession(page);
  const fingers = distance => [{ x: x - distance, y, id: 1 }, { x: x + distance, y, id: 2 }];
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(32) });
    for (const distance of [44, 56, 72, 90, 104, 128, 144]) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(distance) });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await waitForScale(true);
  } finally { await touch.detach(); }
  await page.mouse.dblclick(x, y);
  await waitForScale(false);
  await drag({ x: x + 102, y }, { x: x - 102, y });
  await page.getByText('2 / 3', { exact: true }).waitFor();
  await gallery.locator('img').first().evaluate(image => image.decode());
  await capture('gallery');
  await drag({ x: x - 102, y }, { x: x + 102, y });
  await page.getByText('1 / 3', { exact: true }).waitFor();
  await drag({ x, y: y - 95 }, { x, y: y + 110 });
  await gallery.waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: '媒体', exact: true, selected: true }).waitFor();

  await button('返回').click();
  await search.waitFor();
  assert.equal(await search.inputValue(), 'JHS-0');
  await page.waitForFunction(offset => {
    const list = document.querySelector('[data-testid="discover-list"]');
    return list && Math.abs(list.scrollTop - offset) <= 2;
  }, anchor, { timeout: 8000 });
  await search.fill('北窗');
  await button('北窗').waitFor();
  await button('沿河的午后').waitFor({ state: 'hidden' });

  await tab('片库').click();
  await page.getByLabel('搜索片库').fill('样片本地备注');
  await button('北窗').waitFor();
  await button('最近更新').click();
  await button('取消').click();
  await button('最近更新').click();
  await button('番号').click();
  await decodeCover(button('北窗'));
  await capture('library');
  await button('多选').click();
  await button('北窗').click();
  await button('批量标记').click();
  await page.getByRole('dialog', { name: '更新选中的 1 部作品' }).waitFor();
  assert.equal(await page.locator('[role="alert"]').count(), 0);
  await capture('library-sheet');
  await button('标为已下载').click();
  await page.getByText('已更新 1 部作品', { exact: true }).waitFor();
  await button('撤销').click();
  await page.getByText('已撤销', { exact: true }).waitFor();

  await tab('追新').click();
  await button('暂缓一天').first().click();
  await tab('暂缓').click();
  await button('恢复待办').waitFor();
  await waitForIndicator('暂缓');
  await decodeCover(button('沿河的午后'));
  await capture('follow');

  await tab('我的').click();
  await button('设置').click();
  const offline115 = page.getByRole('switch', { name: '115 云盘离线', exact: true });
  const offlineInitially = await offline115.isChecked();
  await offline115.click();
  assert.equal(await offline115.isChecked(), !offlineInitially);
  await tab('深色').click();
  await waitForIndicator('深色');
  await button('返回').click();
  await page.getByRole('dialog', { name: '放弃未保存的修改？' }).waitFor();
  await waitForIndicator('深色');
  await capture('settings-discard');
  await button('继续编辑').click();
  await page.getByRole('tab', { name: '深色', exact: true, selected: true }).waitFor();
  assert.equal(await offline115.isChecked(), !offlineInitially);
  await button('返回').click();
  await button('放弃修改').click();
  await button('设置').click();
  await page.getByRole('tab', { name: '跟随系统', exact: true, selected: true }).waitFor();
  assert.equal(await offline115.isChecked(), offlineInitially);
  await tab('深色').click();
  await button('保存设置').click();
  await page.getByText('设置已保存', { exact: true }).waitFor();
  await waitForIndicator('深色');
  const footer = await button('保存设置').boundingBox();
  const toast = await page.getByTestId('glass-toast').boundingBox();
  assert.ok(footer && toast && toast.y + toast.height < footer.y, 'settings feedback clears the save footer');
  await capture('dark');
  const product = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  product.on('pageerror', error => errors.push(error.message));
  await checkProductTasks(product, address);
  await product.close();
  const narrow = await browser.newPage({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true,
    colorScheme: 'dark', reducedMotion: 'reduce' });
  narrow.on('pageerror', error => errors.push(error.message));
  await narrow.goto(address);
  await narrow.getByRole('button', { name: '沿河的午后', exact: true }).waitFor();
  assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && window.innerWidth === 320));
  await captureSettled(narrow, 'dark-discover-narrow');
  await narrow.getByRole('button', { name: '沿河的午后', exact: true }).click();
  await decodeCover(narrow.getByRole('button', { name: '查看封面', exact: true }));
  assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await captureSettled(narrow, 'dark-detail-narrow');
  await narrow.getByRole('button', { name: '返回', exact: true }).click();
  await narrow.getByRole('tab', { name: '我的', exact: true }).click();
  await narrow.getByRole('button', { name: '设置', exact: true }).click();
  assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await captureSettled(narrow, 'dark-narrow');
  await narrow.close();
  assert.deepEqual(errors, []);
  console.log('Chrome 390×844: floating navigation, catalog scroll restored, remarks and undo, pinch and double-tap zoom, gallery swipe and dismissal, library filters, follow slider, and settings drafts passed.');
  console.log('Chrome 320×720: discovery, detail, and settings fit the viewport with reduced motion.');

  const receiptKey = 'jhs_offline_receipt_v1:' + 'a'.repeat(64);
  const receipt = JSON.stringify({ attemptId: 'v28-attempt', providerId: '115', state: 'pending', at: 1 });
  await page.evaluate(async ({ receiptKey, receipt }) => {
    localStorage.setItem(receiptKey, receipt);
    localStorage.setItem('third_party_ttl_cache', 'discardable');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('JAV-JHS');
      request.onupgradeneeded = () => request.result.createObjectStore('appData');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('appData', 'readwrite');
      const store = transaction.objectStore('appData');
      store.put(4, 'data_version');
      store.put([{ carNum: 'JHS-202', remark: '旧片库' }], 'car_list');
      store.put({ replicaId: 'demo' }, 'jhs_webdav_sync_state_v1');
      store.put({ attemptId: 'stale-copy' }, receiptKey);
      store.put('discardable', 'third_party_ttl_cache');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  }, { receiptKey, receipt });
  await page.addInitScript(() => {
    let text = '';
    window.jhsLegacy = { postMessage(message) {
      const value = JSON.parse(message);
      if (value.kind === 'part') text += value.text;
      if (value.kind === 'complete') window.jhsLegacyTest = JSON.parse(text);
      if (value.kind === 'error') window.jhsLegacyTest = { error: true };
    } };
  });
  await page.goto(`${address}/jhs-read-legacy`);
  await page.waitForFunction(() => !!window.jhsLegacyTest);
  const snapshot = await page.evaluate(() => window.jhsLegacyTest);
  assert.equal(snapshot.store, 'JAV-JHS/appData');
  assert.equal(snapshot.entries.filter(([key]) => key === receiptKey).length, 1);
  assert.deepEqual(Object.fromEntries(snapshot.entries), { car_list: [{ carNum: 'JHS-202', remark: '旧片库' }], data_version: 4,
    jhs_webdav_sync_state_v1: { replicaId: 'demo' }, [receiptKey]: receipt });
  console.log('Chrome V28 migration: exported the IndexedDB library and the current localStorage receipt exactly once.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
