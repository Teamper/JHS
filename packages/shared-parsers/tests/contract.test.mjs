import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { JAVDB_ORIGIN, catalogRoute, cheerioDocument, parseCatalogDocument, parseJavBusCatalogDetail } from '../index.js';

const require = createRequire(new URL('../../../apps/mobile/package.json', import.meta.url));
const { load } = require('cheerio/slim');
const fixture = path => readFile(new URL('../../../tests/fixtures/integrations/' + path, import.meta.url), 'utf8');
const doc = (html, url = JAVDB_ORIGIN) => cheerioDocument(load(html), url);

test('public catalog routing accepts all categories, rankings, periods and actor searches', () => {
  for (const category of ['all', 'censored', 'uncensored', 'western', 'fc2', 'anime']) {
    const suffix = ['all', 'censored'].includes(category) ? '' : '/' + category;
    assert.equal(catalogRoute('/v1/browse', `category=${category}&facets=1&c10=82`).path, `/tags${suffix}?c10=82`);
  }
  for (const ranking of ['movies', 'playback', 'top', 'actors', 'fanza_award']) {
    for (const period of ['daily', 'weekly', 'monthly']) {
      assert.equal(catalogRoute('/v1/rankings/' + ranking, 'page=2&p=' + period).path, `/rankings/${ranking}?page=2&p=${period}`);
    }
  }
  assert.deepEqual(catalogRoute('/v1/search', 'mode=actor&q=demo'), { path: '/search?q=demo&f=actor', type: 'actors' });
  assert.equal(catalogRoute('/v1/actors/a1/movies', 'page=2').path, '/actors/a1?page=2');
  assert.throws(() => catalogRoute('/v1/browse', 'category=fc2&c1=https://localhost'), /无效/);
});

test('Cheerio and an injected browser DOM give the same result on the repository actor and movie fixtures', async () => {
  for (const [name, route, url, expected] of [
    ['javdb/valid.html', { type: 'actors' }, JAVDB_ORIGIN + '/search?f=actor&q=actor', 'a1'],
    ['javdb/actor-movies.html', { type: 'list' }, JAVDB_ORIGIN + '/actors/a1', 'a'],
  ]) {
    const html = '<main>' + await fixture(name) + '</main>';
    const dom = new JSDOM(html, { url });
    try {
      const parsed = parseCatalogDocument(doc(html, url), route);
      assert.deepEqual(parsed, parseCatalogDocument(dom.window.document, route));
      assert.equal(parsed.items[0]?.id, expected);
    } finally { dom.window.close(); }
  }
  const url = 'https://www.javbus.com/ABC-123';
  const parsed = parseJavBusCatalogDetail(doc(await fixture('javbus/detail.html'), url), url);
  assert.equal(parsed.carNum, 'ABC-123');
  assert.equal(parsed.stills[0]?.url, 'https://image.mgstage.com/images/sample.jpg');
  assert.equal(parsed.stills[0]?.thumbnail, 'https://www.javbus.com/thumbs/sample.jpg');
});

test('detail keeps public media and checked identities while rejecting malformed and unsafe links', () => {
  const url = JAVDB_ORIGIN + '/v/demo';
  const uri = 'magnet:?xt=urn:btih:' + '0'.repeat(40);
  const html = `<div class="video-detail"><h2 class="video-title"><strong>FC2-PPV-1234567</strong> 示例</h2>
    <div class="movie-panel-info"><div class="panel-block"><strong>日期:</strong><span class="value">2025-05-12</span></div>
      <div class="panel-block"><strong>評分:</strong><span class="value">4.8分, 1,240人</span></div>
      <div class="panel-block"><strong>演員:</strong><a href="/actors/demo-actor">示例演员</a><a href="https://evil.test/actors/fake">外部演员</a></div>
    </div>
    <div class="preview-images"><a href="/stills/demo.jpg"><img src="/thumbs/demo.jpg"></a>
      <a href="http://site.test/unsafe.jpg"><img src="/thumbs/unsafe.jpg"></a>
      <a class="preview-video-container"><img src="/poster.jpg"></a><video id="preview-video" src="/clip.mp4"></video></div>
    <div id="magnets-content"><div class="item"><a href="${uri}"><span class="name">样片</span><span class="meta">1 GB</span></a><span class="tags">字幕</span></div>
      <a href="magnet:?xt=evil">无效</a></div>
    <div class="movie-list"><a class="tile-item" href="/v/next"><span class="video-number">ABC-123</span><span class="video-title">后续</span></a>
      <a href="https://example.test/v/wrong">外部</a></div></div>`;
  const result = parseCatalogDocument(doc(html, url), { type: 'movie', id: 'demo' });
  assert.equal(result.ratingValue, 4.8);
  assert.equal(result.voteCount, 1240);
  assert.equal(result.releaseDate, '2025-05-12');
  assert.deepEqual(result.actors.map(actor => actor.id), ['demo-actor']);
  assert.deepEqual(result.images, [JAVDB_ORIGIN + '/stills/demo.jpg']);
  assert.equal(result.preview.video, JAVDB_ORIGIN + '/clip.mp4');
  assert.deepEqual(result.magnets, [{ uri, name: '样片', meta: '1 GB', subtitle: true }]);
  assert.deepEqual(result.related.map(movie => movie.id), ['next']);
  const gated = parseCatalogDocument(doc(html.replace('class="preview-video-container"', 'class="preview-video-container" data-auth-open'), url), { type: 'movie' });
  assert.equal(gated.preview.video, null);
  assert.throws(() => parseCatalogDocument(doc('<div class="movie-panel-info"><h4>bad'), { type: 'movie' }), { code: 'PARSE_ERROR' });
  assert.throws(() => parseCatalogDocument(doc('<main><div class="movie-list"><a href="https://evil.test/v/injected">offsite'), { type: 'list' }), { code: 'PARSE_ERROR' });
  const malformedPagination = '<main><div class="empty-message">无结果</div><a class="pagination-next" href="https://[broken">下一页';
  assert.deepEqual(parseCatalogDocument(doc(malformedPagination), { type: 'list' }), { items: [], nextPage: null });
});
