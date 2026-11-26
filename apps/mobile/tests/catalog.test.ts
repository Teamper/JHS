import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AbortController as NativeAbortController } from 'abort-controller';
import { CatalogSource, parseCatalog, parseDetail } from '../src/data/catalog/CatalogSource.ts';
import { sampleMovies } from '../src/data/models/samples.ts';

test('a catalog page uses verified numbers and retains pagination independently of off-origin links', () => {
  const page = parseCatalog(`<div class="movie-list"><a class="box" href="/v/sample"><img src="https://images.example/one.jpg">
    <div class="video-title"><strong>JHS-001</strong>お試し映画</div><div class="meta">2025-01-03</div></a>
    <a href="https://other.javdb.com/v/unrelated">wrong location</a></div><a class="pagination-next" href="?page=3">more</a>`,
    'https://javdb.com/?page=2', 'javdb', 2);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]?.title, 'お試し映画');
  assert.equal(page.items[0]?.carNum, 'JHS-001');
  assert.equal(page.next, 3);
  const detail = parseDetail(`<h2 class="title"><span class="current-title">另一个作品</span></h2>
    <div class="movie-panel-info"><div class="first-block"><span class="value">JHS-999</span></div></div>`, page.items[0]!);
  assert.deepEqual(detail.stateEligibility, { eligible: false, reason: 'conflicting' });
  assert.equal(detail.carNum, 'JHS-001');
});

test('official login and verification redirects stop the anonymous read', async () => {
  const requested: string[] = [];
  const catalog = new CatalogSource({ async request({ url, requestOptions }) {
    requested.push(url);
    assert.equal(requestOptions.redirect, 'manual');
    return { finalUrl: url, status: 302, responseHeaders: 'location: /doc/driver-verify', data: '' };
  } });
  await assert.rejects(catalog.list({ source: 'javbus', section: 'latest', text: '' }, new AbortController().signal), /完成验证/);
  assert.deepEqual(requested, ['https://www.javbus.com/']);
});

test('the React Native abort-controller signal can read and cancel catalog requests', async () => {
  const catalog = new CatalogSource({ async request() { assert.fail('sample list needs no transport'); } });
  const supported = new NativeAbortController();
  const query = { source: 'sample' as const, section: 'latest' as const, text: '' };
  assert.ok((await catalog.list(query, supported.signal as AbortSignal)).items.length);
  supported.abort();
  await assert.rejects(catalog.list(query, supported.signal as AbortSignal), { name: 'AbortError' });
});

test('sample posters and stills use the native image loader data URL format', () => {
  const first = sampleMovies[0]!;
  const pictures = [first.coverUrl!, ...first.images!];
  assert.ok(pictures.length > 1);
  for (const picture of pictures) {
    assert.ok(picture.startsWith('data:image/svg+xml;base64,'));
    assert.match(Buffer.from(picture.slice(picture.indexOf(',') + 1), 'base64').toString('utf8'), /^<svg /);
  }
  assert.equal(sampleMovies[5]!.coverUrl, undefined);
});

test('detail source navigation uses only known HTTPS origins and rejects credentials', () => {
  const catalog = new CatalogSource({ async request() { throw new Error('source link validation does not request a page'); } });
  const movie = { ...sampleMovies[0]!, source: 'fc2' as const };
  assert.equal(catalog.sourcePage({ ...movie, url: 'https://123av.com/video/sample' }), 'https://123av.com/video/sample');
  assert.throws(() => catalog.sourcePage({ ...movie, url: 'http://123av.com/video/sample' }), /支持的来源/);
  assert.throws(() => catalog.sourcePage({ ...movie, url: 'https://sub.123av.com/video/sample' }), /支持的来源/);
  assert.throws(() => catalog.sourcePage({ ...movie, url: 'https://user@123av.com/video/sample' }), /用户身份/);
});

test('the deferred public trailer uses its same-origin endpoint without a session', async () => {
  const base = 'https://javdb.com';
  const movie = { ...sampleMovies[0]!, source: 'javdb' as const, url: base + '/v/test' };
  const html = '<meta name="csrf-token" content="fixture"><div class="video-detail"><h2 class="video-title">示例</h2><video id="preview-video" data-url="/preview/test"></video></div>';
  const preview = parseDetail(html, movie);
  const calls: string[] = [];
  const catalog = new CatalogSource({ async request({ url, headers, requestOptions }) {
    calls.push(url);
    assert.equal(headers['X-CSRF-Token'], 'fixture');
    assert.equal(requestOptions.anonymous, true);
    assert.equal(requestOptions.redirect, 'error');
    return { finalUrl: url, status: 200, data: { url: 'https://cdn.example.test/public.mp4' } };
  } });
  assert.equal(await catalog.trailer(preview, new AbortController().signal), 'https://cdn.example.test/public.mp4');
  const injected = parseDetail(html.replace('/preview/test', 'https://other.test/preview/test'), movie);
  await assert.rejects(catalog.trailer(injected, new AbortController().signal), /暂无公开预告/);
  assert.deepEqual(calls, [base + '/preview/test']);
});
