import { JhsError, type HttpService, type JavDbListService } from '@jhs/core';
import { JAVDB_ORIGIN, saveWebReview } from '@jhs/parsers';
import type { Movie } from '../models/movie.ts';
import type { AccountSessions } from './AccountSessions.ts';

export type RemoteList = { id: string; name: string; count: number | null; checked: boolean; disabled: boolean };

export function javdbVideo(movie: Movie) {
  if (movie.source !== 'javdb' && movie.source !== 'fc2' || !movie.url || !URL.canParse(movie.url)) return null;
  const url = new URL(movie.url);
  return url.origin === JAVDB_ORIGIN && !url.username && !url.password ? /^\/v\/([A-Za-z0-9_-]{1,128})\/?$/.exec(url.pathname)?.[1] ?? null : null;
}

export class JavDbActions {
  private readonly posting = new Set<string>();
  private readonly accounts: AccountSessions;
  private readonly lists: JavDbListService;
  private readonly http: Pick<HttpService, 'request'>;
  private readonly documentFrom: (html: string, url: string) => Document;

  constructor(accounts: AccountSessions, lists: JavDbListService, http: Pick<HttpService, 'request'>,
    documentFrom: (html: string, url: string) => Document) {
    this.accounts = accounts;
    this.lists = lists;
    this.http = http;
    this.documentFrom = documentFrom;
  }

  async review(movie: Movie, kind: 'want' | 'watched', score: number, signal?: AbortSignal) {
    const id = javdbVideo(movie);
    if (!id) throw new JhsError('INVALID_URL', '作品缺少可靠的 JavDB 来源。');
    if (this.posting.has(id)) throw new JhsError('OPERATION_FAILED', '正在核对这部作品的原站状态。');
    this.posting.add(id);
    try {
      return await this.accounts.run('javdb', signal, scope => saveWebReview(
        id, kind, score, { services: { http: this.http, javdbLists: this.lists } }, scope, this.documentFrom,
      ));
    } finally { this.posting.delete(id); }
  }

  directory(videoId: string | null, signal?: AbortSignal) {
    return this.accounts.run('javdb', signal, async scope => {
      const access = await this.lists.access(scope);
      if (!access.account) throw new JhsError('AUTH_REQUIRED', '请先登录 JavDB。');
      const items: RemoteList[] = await this.lists.directory(access, videoId, scope);
      const current = await this.lists.access(scope);
      if (current.account?.fingerprint !== access.account.fingerprint) throw new JhsError('ABORTED', 'JavDB 账号已切换。');
      return { items, account: access.account };
    });
  }

  update(movies: Movie[], list: RemoteList, checked: boolean, expectedAccount: string, signal?: AbortSignal) {
    return this.accounts.run('javdb', signal, async scope => {
      const task = await this.lists.createTask({ movies, lists: [list], checked, expectedAccount }, scope);
      scope.assertActive();
      return this.lists.resume(task.id, scope.signal);
    });
  }
}
