import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { LifecycleScope, MediaConnectionValidationError, mediaConnectionErrorLabel } from '@jhs/core';
import type { Connections } from '../../data/connections/installConnections.ts';
import { validateMediaDraft, type MediaConnection, type MediaDraft } from '../../data/connections/mediaDraft.ts';
import { useAppearance } from '../../design/appearance.ts';
import { SegmentedControl } from '../../design/components/SegmentedControl.tsx';
import { Body, Button, GroupedList, styles } from '../../design/components/ui.tsx';
import { useScreenSignal } from '../cloud/useSession.ts';

const types = [{ value: 'emby', label: 'Emby' }, { value: 'jellyfin', label: 'Jellyfin' }] as const;
const fields = [['name', '服务器名称'], ['address', 'HTTPS 地址'], ['apiKey', 'API Key'], ['userId', '用户 ID（可选）']] as const;

export function useMediaDraft(media: Connections['media'], feedback: (message: string) => void) {
  const previous = useRef<MediaConnection[]>([]);
  const revision = useRef<string | null>(null);
  const [base, setBase] = useState<MediaDraft[]>([]);
  const [edit, setEdit] = useState<MediaDraft[] | null>(null);
  const [loading, setLoading] = useState(!!media);
  const [failure, setFailure] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const getSignal = useScreenSignal();

  function apply(config: { connections: MediaConnection[]; revision: string | null }) {
    previous.current = config.connections;
    revision.current = config.revision;
    setBase(config.connections.map(item => ({ ...item, type: item.type as MediaDraft['type'], apiKey: '' })));
    setEdit(null);
    setErrors({});
  }

  useEffect(() => {
    if (!media) return;
    let active = true;
    void media.getConfiguration().then(config => { if (active) apply(config); },
      error => { if (active) setFailure(mediaConnectionErrorLabel(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [media]);

  const items = edit ?? base;
  const dirty = edit !== null && JSON.stringify(items) !== JSON.stringify(base);

  function reset() { setEdit(null); setErrors({}); }
  function update(id: string, patch: Partial<MediaDraft>) {
    setEdit(old => (old ?? base).map(item => item.id === id ? { ...item, ...patch } : item));
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(id + ':'))));
  }
  function add() {
    setEdit(old => [...(old ?? base), { id: crypto.randomUUID(), type: 'emby', name: '', address: '', apiKey: '', userId: '', enabled: true }]);
  }
  function remove(id: string) { setEdit(old => (old ?? base).filter(item => item.id !== id)); }
  function validate(item: MediaDraft) {
    try { return validateMediaDraft(item, previous.current.find(entry => entry.id === item.id)); }
    catch (error) {
      if (error instanceof MediaConnectionValidationError) setErrors(current => ({ ...current, [item.id + ':' + error.field]: error.message }));
      throw error;
    }
  }
  async function save() {
    if (!media || !dirty) return;
    const normalized = items.map(validate);
    await media.saveConnections(normalized, revision.current);
    apply(await media.getConfiguration());
  }
  async function test(item: MediaDraft) {
    if (!media || testing) return;
    const signal = getSignal();
    const scope = new LifecycleScope('media-connection-test');
    const cancel = () => scope.dispose();
    signal?.addEventListener('abort', cancel, { once: true });
    setTesting(item.id);
    try {
      const connection = validate(item);
      await media.testConnection(connection, scope);
      if (!scope.disposed) feedback('媒体库连接正常');
    } catch (error) { if (!scope.disposed) feedback(mediaConnectionErrorLabel(error)); }
    finally { signal?.removeEventListener('abort', cancel); cancel(); setTesting(null); }
  }
  return { items, dirty, loading, failure, errors, testing, reset, update, add, remove, save, test,
    hasSavedKey: (id: string) => previous.current.some(item => item.id === id && item.apiKey) };
}

export function MediaSettings({ draft, enabled, toggle, disabled }: {
  draft: ReturnType<typeof useMediaDraft>; enabled: boolean; toggle: (next: boolean) => void; disabled: boolean;
}) {
  const { palette } = useAppearance();
  return <GroupedList>
    <View style={layout.toggle}><Body bold>媒体库联动</Body>
      <Switch accessibilityLabel="媒体库联动" value={enabled} onValueChange={toggle} trackColor={{ true: palette.accent }} disabled={disabled} />
    </View>
    {draft.failure && <Body muted style={layout.group}>{draft.failure}</Body>}
    {draft.items.map(item => <View key={item.id} style={layout.group}>
      <SegmentedControl value={item.type} options={types} onChange={type => draft.update(item.id, { type })} />
      <View style={styles.row}><Body>启用此服务器</Body>
        <Switch accessibilityLabel="启用此服务器" value={item.enabled} onValueChange={enabled => draft.update(item.id, { enabled })}
          disabled={disabled} trackColor={{ true: palette.accent }} />
      </View>
      {fields.map(([field, label]) => <View key={field} style={{ gap: 4 }}>
        <Body muted size={13}>{label}</Body>
        <TextInput accessibilityLabel={label} value={item[field]} editable={!disabled}
          onChangeText={value => draft.update(item.id, { [field]: value })} autoCapitalize={field === 'name' ? 'sentences' : 'none'}
          autoCorrect={false} secureTextEntry={field === 'apiKey'}
          placeholder={field === 'apiKey' && draft.hasSavedKey(item.id) ? '保留已保存的密钥' : undefined}
          placeholderTextColor={palette.textTertiary}
          style={[layout.input, { color: palette.textPrimary, backgroundColor: palette.surfaceRecessed, borderColor: palette.hairline }]} />
        {draft.errors[item.id + ':' + field] && <Body size={13} style={{ color: palette.danger }}>{draft.errors[item.id + ':' + field]}</Body>}
      </View>)}
      <View style={styles.row}>
        <Button disabled={disabled || !!draft.testing} onPress={() => void draft.test(item)}>{draft.testing === item.id ? '检查中' : '检查连接'}</Button>
        <Button disabled={disabled} variant="ghost" onPress={() => draft.remove(item.id)}>移出服务器</Button>
      </View>
    </View>)}
    <View style={layout.group}><Button disabled={disabled || draft.loading || !!draft.failure || draft.items.length >= 20}
      onPress={draft.add}>添加媒体服务器</Button></View>
  </GroupedList>;
}

const layout = StyleSheet.create({
  group: { padding: 14, gap: 10 },
  toggle: { padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, fontSize: 15 },
});
