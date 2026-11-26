import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { androidDevice } from './nativeBridge.ts';

export async function chooseBackup() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0]!;
  const file = new File(asset.uri);
  const size = asset.size ?? file.size;
  if (size > 64 * 1024 * 1024) throw new Error('备份文件超过 64 MB。');
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  try { return await file.text(); }
  finally { if (file.exists) file.delete(); }
}

export async function saveBackup(value: string) {
  const title = `JHS-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = title;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const name = `jhs-${randomUUID()}.json`;
  const file = new File(Paths.cache, name);
  file.write(value);
  if (androidDevice) {
    try { await androidDevice.exportBackup(name, title); }
    catch (error) { if (file.exists) file.delete(); throw error; }
    return;
  }
  try { await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: title }); }
  finally { if (file.exists) file.delete(); }
}
