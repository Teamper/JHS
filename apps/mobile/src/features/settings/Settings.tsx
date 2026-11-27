import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { usePreventRemove, type NavigationAction } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseBooleanSetting } from '@jhs/core';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useSettingsValue, useThemeSetting, type ThemeSetting } from '../../data/queries/useThemeSetting.ts';
import { translateTitles } from '../../data/queries/useTranslatedTitle.ts';
import { useApp } from '../../data/workspace/context.ts';
import { useAppearance, usePrivacy } from '../../design/appearance.ts';
import { AppBottomSheet } from '../../design/components/AppBottomSheet';
import { SegmentedControl } from '../../design/components/SegmentedControl.tsx';
import { Body, Button, GroupedList, Line, Page, errorText, styles } from '../../design/components/ui.tsx';
import { settingsFooter } from '../../design/tokens/metrics.ts';
import { useRoot } from '../navigation.ts';
import { MediaSettings, useMediaDraft } from './MediaSettings.tsx';

const themes = [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }] as const;
const connections = [
  { key: 'enable115Offline', label: '115 云盘离线', fallback: false },
  { key: 'enable123Offline', label: '123 云盘离线', fallback: true },
  { key: 'enableMediaLibrary', label: '媒体库联动', fallback: false },
] as const;
type ConnectionSetting = typeof connections[number]['key'];

export function Settings() {
  const { workspace, feedback, connections: services } = useApp();
  const { masked, togglePrivacy } = usePrivacy();
  const navigation = useRoot();
  const queryClient = useQueryClient();
  const saved = useThemeSetting(workspace);
  const savedTranslation = useSettingsValue(workspace, translateTitles);
  const snapshot = useSettingsValue(workspace, settings => settings);
  const { palette } = useAppearance();
  const [draft, setDraft] = useState<ThemeSetting | null>(null);
  const [translationDraft, setTranslationDraft] = useState<boolean | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<Partial<Record<ConnectionSetting, boolean>>>({});
  const [leave, setLeave] = useState<NavigationAction | null>(null);
  const theme = draft ?? saved;
  const media = useMediaDraft(services.media, feedback);
  const savedValue = (key: ConnectionSetting) => parseBooleanSetting(snapshot[key], connections.find(item => item.key === key)!.fallback);
  const connectionValue = (key: ConnectionSetting) => connectionDraft[key] ?? savedValue(key);
  const change = (key: ConnectionSetting, value: boolean) => setConnectionDraft(previous => ({ ...previous, [key]: value }));
  const dirty = theme !== saved || (translationDraft ?? savedTranslation) !== savedTranslation || media.dirty ||
    connections.some(({ key }) => connectionValue(key) !== savedValue(key));
  const save = useMutation({
    async mutationFn() {
      await media.save();
      await workspace.settings.patch({
        ...(draft !== null ? { theme: draft } : {}),
        ...(translationDraft !== null ? { androidTranslateTitle: translationDraft } : {}),
        ...connectionDraft,
      });
    },
    onError: error => feedback(errorText(error)),
  });

  usePreventRemove(dirty, ({ data }) => setLeave(data.action));

  return <Page title="设置" back>
    <ScrollView contentContainerStyle={styles.content}>
      <GroupedList>
        <View style={[styles.section, layout.group]}>
          <Body bold>显示主题</Body>
          <SegmentedControl value={theme} onChange={setDraft} options={themes} />
        </View>
        <View style={[layout.group, layout.toggle]}>
          <Body bold>标题翻译为简体中文</Body>
          <Switch accessibilityLabel="标题翻译为简体中文" value={translationDraft ?? savedTranslation}
            onValueChange={setTranslationDraft} trackColor={{ true: palette.accent }} />
        </View>
        <Line label={masked ? '关闭隐私遮罩' : '开启隐私遮罩'} icon={masked ? 'eye' : 'eye-off'} onPress={togglePrivacy} />
        <Line label="备份与恢复" icon="archive" onPress={() => navigation.navigate('Backup')} />
      </GroupedList>
      <GroupedList>{connections.slice(0, 2).map(item => <View key={item.key} style={[layout.group, layout.toggle]}>
        <Body bold>{item.label}</Body>
        <Switch accessibilityLabel={item.label} value={connectionValue(item.key)} onValueChange={value => change(item.key, value)}
          disabled={save.isPending} trackColor={{ true: palette.accent }} />
      </View>)}</GroupedList>
      {services.media && <MediaSettings draft={media} enabled={connectionValue('enableMediaLibrary')}
        toggle={value => change('enableMediaLibrary', value)} disabled={save.isPending} />}
    </ScrollView>
    <View style={layout.footer}>
      <Button primary disabled={!dirty || save.isPending} onPress={() => save.mutate(undefined, {
        onSuccess: () => {
          queryClient.setQueryData(queryKeys.settings, workspace.settings.snapshot());
          setDraft(null);
          setTranslationDraft(null);
          setConnectionDraft({});
          feedback('设置已保存');
        },
      })}>保存设置</Button>
    </View>
    {!!leave && <AppBottomSheet open title="放弃未保存的修改？" close={() => setLeave(null)}>
      <Body bold size={18}>放弃未保存的修改？</Body>
      <View style={layout.actions}>
        <Button variant="ghost" onPress={() => setLeave(null)}>继续编辑</Button>
        <Button variant="danger" disabled={save.isPending} onPress={() => {
          setLeave(null);
          setDraft(null);
          setTranslationDraft(null);
          setConnectionDraft({});
          media.reset();
          navigation.dispatch(leave);
        }}>放弃修改</Button>
      </View>
    </AppBottomSheet>}
  </Page>;
}

const layout = StyleSheet.create({
  group: { padding: 14 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 10 },
  footer: { paddingHorizontal: 16, paddingTop: settingsFooter.top, paddingBottom: settingsFooter.bottom },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
