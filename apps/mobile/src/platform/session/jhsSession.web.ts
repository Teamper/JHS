import { JhsError } from '@jhs/core';
import type { SessionNative } from './types.ts';

async function unavailable(): Promise<never> {
  throw new JhsError('UNSUPPORTED', '网页预览使用样片，账号连接请在 Android 或 iOS 上使用。');
}

export const jhsSession: SessionNative | null = {
  available: async () => false,
  setPrivacy: async () => {},
  openLogin: unavailable,
  request: unavailable,
  clearSession: unavailable,
  cancel: async () => {},
};
