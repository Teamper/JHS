import { requireOptionalNativeModule } from 'expo';
import type { SessionNative } from './types.ts';

export const jhsSession = requireOptionalNativeModule<SessionNative>('JhsSession');
