import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const androidDevice = Platform.OS === 'android' ? requireOptionalNativeModule<{
  readLegacySnapshot(): Promise<{ uri: string; sha256: string } | null>;
  getValue(key: string): Promise<string | null>;
  setValue(key: string, value: string | null): Promise<void>;
  keys(): Promise<string[]>;
  setPrivacy(enabled: boolean): Promise<void>;
  exportBackup(basename: string, filename: string): Promise<void>;
}>('JhsDevice') : null;

const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const secureKey = (key: string) => `jhs.${Array.from(key, character => character.codePointAt(0)!.toString(16).padStart(6, '0')).join('')}`;

export const secure = {
  async getValue(key: string, fallback?: unknown) {
    const value = androidDevice ? await androidDevice.getValue(key) : await SecureStore.getItemAsync(secureKey(key), options);
    return value === null ? fallback : JSON.parse(value);
  },
  setValue(key: string, value: unknown) {
    const json = JSON.stringify(value);
    return androidDevice ? androidDevice.setValue(key, json) : SecureStore.setItemAsync(secureKey(key), json, options);
  },
  removeValue(key: string) {
    return androidDevice ? androidDevice.setValue(key, null) : SecureStore.deleteItemAsync(secureKey(key), options);
  },
  listValues: () => androidDevice?.keys() ?? [],
};
