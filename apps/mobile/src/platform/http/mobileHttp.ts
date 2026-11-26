import { fetch as expoFetch } from 'expo/fetch';
import { throwIfAborted } from '@jhs/core';
import type { NativeRequest } from '../../data/catalog/CatalogSource.ts';
import { requestSession } from './sessionHttp.ts';
import { jhsSession } from '../session/jhsSession';

export const mobileHttp: NativeRequest = {
  async request(options) {
    if (options.session) return requestSession(jhsSession, options);
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    throwIfAborted(options.signal);
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('来源响应超时。')), options.timeout ?? 12_000);
    try {
      await options.beforeSend?.();
      throwIfAborted(controller.signal);
      options.onDispatch?.();
      const response = await expoFetch(options.url, { method: options.method ?? 'GET', headers: options.headers,
        body: options.body ?? options.data, signal: controller.signal, credentials: 'omit', redirect: options.requestOptions?.redirect ?? 'error' });
      const limit = options.maxResponseBytes ?? 8 * 1024 * 1024;
      const advertised = Number(response.headers.get('content-length'));
      if (advertised > limit) throw new Error('来源响应超过大小限制。');
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) { controller.abort(); throw new Error('来源响应超过大小限制。'); }
          chunks.push(value);
        }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const text = options.responseType === 'arraybuffer' ? undefined : new TextDecoder().decode(bytes);
      const data = options.responseType === 'arraybuffer' ? bytes.buffer : options.responseType === 'json' ? JSON.parse(text!) : text;
      const headers: string[] = [];
      response.headers.forEach((value, key) => {
        if (!['set-cookie', 'set-cookie2'].includes(key.toLowerCase())) headers.push(`${key}: ${value}`);
      });
      return { data, responseText: text, status: response.status, finalUrl: response.url || options.url, responseHeaders: headers.join('\n') };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  },
};
