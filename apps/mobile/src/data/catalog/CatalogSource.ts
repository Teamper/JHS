import { load } from 'cheerio/slim';
import { LifecycleScope, getMovieStateEligibility, ExternalUrlPolicy, HttpService, JhsError, throwIfAborted } from '@jhs/core';
import { JAVDB_ORIGIN, SITE_ID, catalogRoute, catalogAccessError, cheerioDocument, parseCatalogDocument, readJavDbActorProfile,
  parseJavBusCatalog, parseJavBusCatalogDetail, readJavBusActorProfile, httpsLink } from '@jhs/parsers';
import { categories as sampleCategories, works } from '@jhs/fixtures';
import { sampleCast, sampleMovies } from '../models/samples.ts';
import type { ActorProfile, ActorRef, Movie, MovieActor, Source } from '../models/movie.ts';
import type { AccountSessions } from '../connections/AccountSessions.ts';

export const categories = { all: '全部', censored: '有码', uncensored: '无码', western: '欧美', fc2: 'FC2', anime: '动画' } as const;
export const rankings = { movies: '作品', playback: '播放', top: '高分', actors: '演员', fanza_award: 'FANZA 奖项' } as const;
export const periods = { daily: '日榜', weekly: '周榜', monthly: '月榜' } as const;
export type CatalogQuery = {
  source: Source; text: string; section: 'latest' | 'ranking'; page?: number;
  category?: keyof typeof categories;
  ranking?: keyof typeof rankings;
  period?: keyof typeof periods;
  mode?: 'movie' | 'actor';
  tags?: Record<string, string>;
  facets?: boolean;
};
export type Facet = { key: string; value: string; label: string };
export type CatalogPage = { items: Movie[]; actors: ActorRef[]; facets: Facet[]; next: number | null; profile?: ActorProfile };
export type NativeRequest = ConstructorParameters<typeof HttpService>[0];

const origins = { javdb: JAVDB_ORIGIN, javbus: 'https://www.javbus.com', fc2: JAVDB_ORIGIN } as const;
export const catalogOrigin = (source: Source) => source === 'sample' ? null : origins[source];

type Card = { id: string; carNum: string | null; title: string; displayTitle?: string; url: string | null;
  coverUrl: string | null; releaseDate: string; ratingValue?: number | null; voteCount?: number | null;
  subtitle?: boolean; stateEligibility: Movie['stateEligibility'] };

function asMovie(item: Card, source: Exclude<Source, 'sample'>): Movie {
  return { id: item.id, source: source !== 'javbus' && item.carNum?.startsWith('FC2') ? 'fc2' : source,
    carNum: item.carNum, title: item.displayTitle || item.title || item.carNum || item.id, url: item.url ?? undefined,
    coverUrl: item.coverUrl ?? undefined, releaseDate: item.releaseDate, rating: item.ratingValue ?? undefined,
    voteCount: item.voteCount ?? undefined, subtitle: item.subtitle, stateEligibility: item.stateEligibility };
}

function asPage(items: Movie[] = [], actors: ActorRef[] = [], facets: Facet[] = [], next: number | null = null): CatalogPage {
  return { items, actors, facets, next };
}

function documentFrom(text: string, pageUrl: string) {
  return cheerioDocument(load(text), pageUrl);
}

export function parseCatalog(text: string, pageUrl: string, source: Exclude<Source, 'sample'>, page: number, type = 'list'): CatalogPage {
  const doc = documentFrom(text, pageUrl);
  if (source === 'javbus') {
    const result = parseJavBusCatalog(doc, pageUrl, page);
    return asPage(result.items.map(item => asMovie(item, source)), [], [], result.nextPage);
  }
  const result = parseCatalogDocument(doc, { type }, pageUrl);
  if (!('items' in result)) throw new Error('无法确认目录结果。');
  const items: Movie[] = [], actors: ActorRef[] = [];
  for (const item of result.items) {
    if ('carNum' in item) items.push(asMovie(item, source));
    else actors.push({ id: item.id, name: item.name, source: 'javdb', coverUrl: item.coverUrl ?? undefined });
  }
  return asPage(items, actors, result.facets ?? [], result.nextPage);
}

export function parseDetail(text: string, movie: Movie): Movie {
  const url = movie.url!;
  const doc = documentFrom(text, url);
  const bus = movie.source === 'javbus';
  const parsed = bus ? parseJavBusCatalogDetail(doc, url) : parseCatalogDocument(doc, { type: 'movie', id: movie.id }, url);
  if (!('carNum' in parsed)) throw new Error('无法确认作品详情。');
  const carNum = movie.carNum ?? parsed.carNum;
  const stateEligibility: Movie['stateEligibility'] = (movie.carNum && parsed.carNum && movie.carNum !== parsed.carNum) || movie.stateEligibility?.reason === 'conflicting'
    ? { eligible: false, reason: 'conflicting' } : parsed.stateEligibility.eligible ? getMovieStateEligibility(carNum) : parsed.stateEligibility;
  const cast: MovieActor[] = parsed.actors.map(actor => ({ id: actor.id, name: actor.name, source: bus ? 'javbus' : 'javdb', url: actor.url ?? undefined }));
  const deferred = 'preview' in parsed && parsed.preview?.deferred;
  const endpoint = deferred && httpsLink(doc.querySelector('video#preview-video')?.getAttribute('data-url'), url, JAVDB_ORIGIN);
  const token = endpoint && doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  return { ...movie, carNum, stateEligibility, title: parsed.title || movie.title, coverUrl: parsed.coverUrl ?? movie.coverUrl,
    releaseDate: parsed.releaseDate || movie.releaseDate, actors: cast.length ? cast.map(actor => actor.name) : movie.actors, cast,
    fields: parsed.fields, stills: parsed.stills, images: parsed.stills.map(item => item.url), magnets: parsed.magnets,
    rating: ('ratingValue' in parsed ? parsed.ratingValue : null) ?? movie.rating,
    voteCount: ('voteCount' in parsed ? parsed.voteCount : null) ?? movie.voteCount,
    subtitle: 'subtitle' in parsed ? parsed.subtitle : parsed.magnets.some(item => item.subtitle),
    trailer: 'preview' in parsed ? parsed.preview?.video ?? undefined : undefined,
    trailerPoster: 'preview' in parsed ? parsed.preview?.poster ?? undefined : undefined,
    previewRequest: endpoint && token ? { url: endpoint, token } : undefined,
    related: bus || !('related' in parsed) ? [] : parsed.related.map(item => asMovie(item!, 'javdb')) };
}

function samplePage(query: CatalogQuery, text: string) {
  const facets = sampleCategories.map((label, index) => ({ key: 'c1', value: String(index + 1), label }));
  const normalized = text.toLowerCase();
  if (query.mode === 'actor' && text || !text && query.section === 'ranking' && query.ranking === 'actors') {
    return asPage([], sampleCast.filter(item => item.name.toLowerCase().includes(normalized)), facets);
  }
  const categoryIds = Object.keys(categories).slice(1);
  const items = sampleMovies.filter((item, index) =>
    (!text || `${item.carNum} ${item.title} ${item.actors?.join(' ')}`.toLowerCase().includes(normalized))
    && (!query.category || query.category === 'all' || categoryIds[index % categoryIds.length] === query.category)
    && (!query.tags?.c1 || works[index]!.category === facets.find(facet => facet.value === query.tags?.c1)?.label));
  if (query.section === 'ranking' && !text) {
    items.sort((a, b) => query.ranking === 'playback' ? (b.voteCount ?? 0) - (a.voteCount ?? 0) : (b.rating ?? 0) - (a.rating ?? 0));
  }
  return asPage(items, [], facets);
}

export class CatalogSource {
  private readonly policy = new ExternalUrlPolicy();
  private readonly http: HttpService;
  private readonly accounts?: AccountSessions;
  private failSampleOnce = false;

  constructor(port: NativeRequest, accounts?: AccountSessions) {
    this.http = new HttpService(port, this.policy);
    this.accounts = accounts;
  }

  simulateListFailure() { this.failSampleOnce = true; }

  sourcePage(movie: Movie) {
    const base = catalogOrigin(movie.source);
    if (!base || !movie.url) throw new Error('作品没有可打开的来源地址。');
    const url = new URL(movie.url);
    const allowed = movie.source === 'fc2' ? [base, 'https://123av.com'] : movie.source === 'javbus' ? [base, 'https://javbus.com'] : [base];
    const expectedOrigin = allowed.find(origin => origin === url.origin);
    if (!expectedOrigin) throw new Error('作品地址不在支持的来源范围内。');
    return this.policy.assertAllowed(url, { trustClass: 'builtin-public', hosts: [url.hostname], expectedOrigin }).href;
  }

  private async read<T>(signal: AbortSignal, request: (scope: LifecycleScope) => Promise<T>) {
    const scope = new LifecycleScope('mobile-catalog');
    const cancel = () => scope.dispose();
    throwIfAborted(signal);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const result = await request(scope);
      scope.assertActive();
      return result;
    } finally {
      signal.removeEventListener('abort', cancel);
      cancel();
    }
  }

  private async html(url: URL, signal: AbortSignal) {
    const request = async (scope: LifecycleScope, authenticated: boolean) => {
      const result = await this.http.request({ url: url.href, responseType: 'text', timeout: 12_000,
        maxResponseBytes: 3 * 1024 * 1024, headers: { Accept: 'text/html' },
        urlPolicy: { trustClass: 'builtin-public', hosts: [url.hostname], expectedOrigin: url.origin },
        ...(authenticated && { session: 'javdb', circuitGroup: 'account-read' }),
        requestOptions: { anonymous: !authenticated, redirect: 'manual' } }, scope);
      scope.assertActive();
      if (result.status >= 300 && result.status < 400) {
        const location = String(result.responseHeaders).match(/^location:\s*(.+)$/im)?.[1];
        const target = httpsLink(location, url, url.origin);
        if (target && /\/(?:login|doc\/driver-verify)(?:\/|$)/.test(new URL(target).pathname)) {
          throw new JhsError('AUTH_REQUIRED', '此来源要求在官方页面登录或完成验证。', { details: { url: target } });
        }
        throw new Error('来源暂时重定向，请从官方页面查看。');
      }
      const body = String(result.data);
      const error = catalogAccessError(result.status, body, url);
      if (error) throw error;
      return body;
    };
    try { return await this.read(signal, scope => request(scope, false)); }
    catch (error) {
      if (url.origin !== JAVDB_ORIGIN || !(error instanceof JhsError) || error.code !== 'AUTH_REQUIRED' || !this.accounts?.available) throw error;
      const connection = this.accounts.get('javdb');
      if (connection.busy) throw error;
      const account = connection.checked ? connection.account : await this.accounts.check('javdb', signal).catch(() => {
        throwIfAborted(signal);
        return null;
      });
      if (!account) throw error;
      return this.accounts.run('javdb', signal, scope => request(scope, true));
    }
  }

  async trailer(movie: Movie, signal: AbortSignal) {
    if (movie.trailer) return movie.trailer;
    const preview = movie.previewRequest;
    if (!preview) throw new Error('来源暂无公开预告。');
    return this.read(signal, async scope => {
      const response = await this.http.request({ url: preview.url, responseType: 'json', timeout: 12_000,
        maxResponseBytes: 64 * 1024, headers: { Accept: 'application/json', 'X-CSRF-Token': preview.token },
        requestOptions: { anonymous: true, redirect: 'error' },
        urlPolicy: { trustClass: 'builtin-public', hosts: ['javdb.com'], expectedOrigin: JAVDB_ORIGIN },
      }, scope);
      const url = httpsLink(typeof response.data?.url === 'string' ? response.data.url : undefined, JAVDB_ORIGIN);
      if (!url) throw new Error('来源没有返回可用预告。');
      return url;
    });
  }

  async list(query: CatalogQuery, signal: AbortSignal): Promise<CatalogPage> {
    throwIfAborted(signal);
    const page = query.page ?? 1;
    const text = query.text.trim();
    if (query.source === 'sample') {
      if (this.failSampleOnce) {
        this.failSampleOnce = false;
        throw new Error('样片读取失败，请重试。');
      }
      return samplePage(query, text);
    }
    if (query.source === 'javbus') {
      const url = new URL(origins.javbus);
      if (text) url.pathname = `/search/${encodeURIComponent(text)}${page > 1 ? `/${page}` : ''}`;
      else if (page > 1) url.pathname = `/page/${page}`;
      return parseCatalog(await this.html(url, signal), url.href, query.source, page);
    }
    const params = new URLSearchParams({ page: String(page) });
    let path = '/v1/browse';
    if (text) {
      path = '/v1/search';
      params.set('q', text);
      params.set('mode', query.mode ?? 'movie');
    } else if (query.section === 'ranking') {
      path = '/v1/rankings/' + (query.ranking ?? 'top');
      if (query.period) params.set('p', query.period);
    } else {
      params.set('category', query.source === 'fc2' ? 'fc2' : query.category ?? 'all');
      if (query.facets) params.set('facets', '1');
      for (const [key, value] of Object.entries(query.tags ?? {})) params.set(key, value);
    }
    const route = catalogRoute(path, params);
    const url = new URL(route.path, origins[query.source]);
    const response = parseCatalog(await this.html(url, signal), url.href, query.source, page, route.type);
    if (query.source === 'fc2' && text) response.items = response.items.filter(item => item.source === 'fc2' && item.carNum?.startsWith('FC2'));
    return response;
  }

  async actor(actor: ActorRef, page: number, signal: AbortSignal, newest = false) {
    throwIfAborted(signal);
    if (actor.source === 'sample') {
      const profile = sampleCast.find(item => item.id === actor.id);
      return { ...asPage(sampleMovies.filter(item => item.cast?.some(member => member.id === actor.id))),
        profile: profile ? { ...profile, names: [profile.name] } : undefined };
    }
    if (!SITE_ID.test(actor.id)) throw new Error('演员地址无效。');
    if (actor.source === 'javbus') {
      const url = new URL(`/star/${actor.id}${page > 1 ? '/' + page : ''}`, origins.javbus);
      const html = await this.html(url, signal);
      const result = parseCatalog(html, url.href, actor.source, page);
      const profile = page === 1 ? readJavBusActorProfile(documentFrom(html, url.href), url.href, actor.id) : null;
      return { ...result, profile: profile ? { ...profile, source: 'javbus' as const, coverUrl: profile.coverUrl ?? undefined } : undefined };
    }
    const route = catalogRoute('/v1/actors/' + actor.id + '/movies', new URLSearchParams({ page: String(page) }));
    const url = new URL(route.path, JAVDB_ORIGIN);
    if (newest) url.searchParams.set('t', 'd');
    const html = await this.html(url, signal);
    const result = parseCatalog(html, url.href, 'javdb', page);
    const profile = page === 1 ? readJavDbActorProfile(documentFrom(html, url.href), url) : null;
    return { ...result, profile: profile ? { ...profile, source: 'javdb' as const, coverUrl: profile.coverUrl ?? undefined } : undefined };
  }

  async detail(movie: Movie, signal: AbortSignal) {
    if (movie.source === 'sample') {
      const item = sampleMovies.find(item => item.carNum === movie.carNum);
      if (!item) return movie;
      const index = sampleMovies.indexOf(item);
      return { ...item, related: sampleMovies.slice(index + 1, index + 5), trailer: works[index]?.trailer ? 'sample' : undefined };
    }
    if (!movie.url) return movie;
    const url = new URL(this.sourcePage(movie));
    if (movie.source === 'javbus' ? !/^\/[\w-]{1,64}\/?$/.test(url.pathname) : !/^\/v\/[\w-]{1,64}\/?$/.test(url.pathname)) return movie;
    if (movie.source === 'fc2' && url.origin !== JAVDB_ORIGIN) return movie;
    return parseDetail(await this.html(url, signal), { ...movie, url: url.href });
  }
}
