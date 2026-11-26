import { toByteArray } from 'base64-js';
import { JhsError, throwIfAborted } from '@jhs/core';
import type { SessionNative, SessionSite } from '../session/types.ts';

type Options = {
  session: SessionSite;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  data?: string;
  responseType?: string;
  maxResponseBytes?: number;
  timeout?: number;
  nativeTimeout?: number;
  signal?: AbortSignal;
  beforeSend?: () => Promise<unknown>;
  onDispatch?: () => void;
  requestOptions?: { redirect?: string };
};

export async function requestSession(native: SessionNative | null, options: Options) {
  if (!native) throw new JhsError('UNSUPPORTED', '当前安装包未提供原生账号会话。');
  const { signal, url, session } = options;
  throwIfAborted(signal);
  await options.beforeSend?.();
  throwIfAborted(signal);
  const requestId = crypto.randomUUID();
  const abort = () => { void native.cancel(requestId).catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const binary = options.responseType === 'arraybuffer';
    options.onDispatch?.();
    const result = await native.request({
      requestId, session, url, binary,
      method: options.method ?? 'GET', headers: options.headers ?? {}, body: options.body ?? options.data,
      limit: options.maxResponseBytes ?? 8 * 1024 * 1024, timeout: options.nativeTimeout ?? options.timeout ?? 12_000,
    }).catch(error => {
      throwIfAborted(signal);
      const code = error?.code;
      const allowed = ['TIMEOUT', 'ABORTED', 'INVALID_URL', 'RESPONSE_TOO_LARGE', 'UNSUPPORTED', 'NETWORK_ERROR'];
      throw new JhsError(allowed.includes(code) ? code : 'NETWORK_ERROR',
        error instanceof Error ? error.message : '会话请求失败。', { source: session, cause: error });
    });
    throwIfAborted(signal);
    if (result.status >= 300 && result.status < 400 && result.status !== 304 && options.requestOptions?.redirect !== 'manual') {
      const location = /^location:\s*([^\r\n]+)/im.exec(result.headers)?.[1]?.trim();
      const target = location && URL.canParse(location, url) ? new URL(location, url) : null;
      if (session !== 'javdb' || target?.origin === 'https://javdb.com' && target.pathname === '/login') {
        throw new JhsError('AUTH_REQUIRED', '服务要求登录后再继续。');
      }
      throw new JhsError('INVALID_URL', '会话请求被重定向。');
    }
    const text = binary ? undefined : result.body;
    let data: unknown = binary ? toByteArray(result.body).buffer : text;
    if (options.responseType === 'json' && result.status < 300) {
      try { data = JSON.parse(result.body); }
      catch (cause) {
        // Keep verification pages intact for HttpService's challenge detection.
        if (!/^\s*</.test(result.body)) throw new JhsError('PARSE_ERROR', '来源响应格式无效。', { cause });
      }
    }
    return { data, responseText: text, status: result.status, finalUrl: result.url, responseHeaders: result.headers };
  } finally { signal?.removeEventListener('abort', abort); }
}
