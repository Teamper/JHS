import { useAppearance } from '../../design/appearance.ts';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Body, Button, Choices, Line, Page, errorText, styles, type Menu } from '../../design/components/ui.tsx';
import { useApp } from '../../data/workspace/context.ts';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';

export function Sync() {
  const { workspace, feedback } = useApp();
  const { palette } = useAppearance();
  const sync = workspace.sync!;
  const focused = useScreenQuery(queryKeys.sync);
  const { data: status, error: statusError } = useQuery({ queryKey: queryKeys.sync, queryFn: sync.status, enabled: focused });
  const [draft, setDraft] = useState({ url: '', username: '', password: '' });
  const [passwordStored, setPasswordStored] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof sync.listVersions>> | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

  useEffect(() => {
    let active = true;
    void sync.profile().then(profile => {
      if (!active) return;
      setDraft({ url: profile.url, username: profile.username, password: '' });
      setPasswordStored(profile.hasPassword);
    }, error => { if (active) feedback(errorText(error)); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [sync]);

  async function submit(save: boolean) {
    setBusy(true);
    try {
      if (save) {
        await sync.save(draft.url, draft.username, draft.password);
        setDraft(value => ({ ...value, password: '' })); setPasswordStored(true);
      }
      await sync.check();
    } catch (error) { feedback(errorText(error)); }
    finally { setBusy(false); }
  }

  async function readVersions() {
    setBusy(true);
    try { setVersions(await sync.listVersions()); }
    catch (error) { feedback(errorText(error)); }
    finally { setBusy(false); }
  }

  return <Page title="多端同步" back><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Body muted>{statusError ? errorText(statusError) : status?.message || (status?.configured ? 'WebDAV 已连接' : '填写与桌面相同的 WebDAV 连接后即可同步。')}</Body>
    {(['url', 'username', 'password'] as const).map(key => {
      const label = { url: 'WebDAV 地址', username: '用户名', password: '密码' }[key];
      return <View key={key} style={{ gap: 5 }}><Body bold>{label}</Body>
        <TextInput accessibilityLabel={label} value={draft[key]} onChangeText={value => setDraft(form => ({ ...form, [key]: value }))}
          editable={ready && !busy} autoCapitalize="none" autoCorrect={false} secureTextEntry={key === 'password'}
          placeholder={key === 'url' ? 'https://' : key === 'password' && passwordStored ? '已保存' : undefined}
          placeholderTextColor={palette.textSecondary} style={{ minHeight: 49, borderRadius: 9, borderWidth: 1, borderColor: palette.hairline,
            paddingHorizontal: 12, backgroundColor: palette.surface, color: palette.textPrimary }} />
      </View>;
    })}
    <View style={styles.row}><Button primary disabled={!ready || busy || !draft.url} onPress={() => void submit(true)}>保存并同步</Button>
      <Button disabled={busy || !status?.configured} icon="refresh-cw" onPress={() => void submit(false)}>立即同步</Button></View>
    <Button icon="clock" disabled={busy || !status?.configured} onPress={() => void readVersions()}>查看历史版本</Button>
    {versions?.map(version => <Line key={version.name} label={version.name} icon="archive" onPress={() => setMenu({
      title: '恢复此版本的作品与偏好', actions: [{ label: '确认恢复', run: () => {
        setBusy(true);
        void sync.restore(version.name).then(() => feedback('已恢复历史版本'), error => feedback(errorText(error))).finally(() => setBusy(false));
      } }],
    })} />)}
    {versions?.length === 0 && <Body muted>暂无可恢复的同步版本。</Body>}
  </ScrollView><Choices menu={menu} close={() => setMenu(null)} /></Page>;
}
