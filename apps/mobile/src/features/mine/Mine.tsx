import { useTabContentInset } from '../../design/components/ScreenScaffold.tsx';
import { useAppearance } from '../../design/appearance.ts';
import { ScrollView, View } from 'react-native';
import { Body, GroupedList, Line, Page, Status, errorText, styles } from '../../design/components/ui.tsx';
import { useApp } from '../../data/workspace/context.ts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';
import { useRoot } from '../navigation.ts';

export function Mine() {
  const { workspace, catalog, feedback } = useApp();
  const client = useQueryClient();
  const { palette } = useAppearance();
  const navigation = useRoot();
  const bottomInset = useTabContentInset();
  const focused = useScreenQuery(queryKeys.summary);
  const summary = useQuery({ queryKey: queryKeys.summary, queryFn: () => workspace.database.summary(), enabled: focused });
  const total = summary.data ?? { all: 0, favorite: 0, watched: 0, downloaded: 0 };
  return <Page title="我的"><ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
    <View style={{ backgroundColor: palette.surfaceElevated, borderRadius: 16, padding: 17, gap: 11 }}>
      <Body bold size={17}>片库概览</Body>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        {[[total.all, '作品'], [total.favorite, '收藏'], [total.watched, '已看'], [total.downloaded, '已下载']].map(([value, label]) =>
          <View key={label} style={{ alignItems: 'center', minWidth: 55 }}><Body bold size={22}>{value}</Body><Body muted size={13}>{label}</Body></View>)}
      </View>
    </View>
    {summary.error && <Status message={errorText(summary.error)} retry={() => void summary.refetch()} />}
    <GroupedList>
      <Line label="账号连接" subtitle="JavDB、115 云盘、123 云盘" icon="user" onPress={() => navigation.navigate('Accounts')} />
      <Line label="云盘任务" icon="archive" onPress={() => navigation.navigate('Cloud')} />
    </GroupedList>
    <GroupedList>
    {workspace.sync && <Line label="多端同步" icon="refresh-cw" onPress={() => navigation.navigate('Sync')} />}
    <Line label="演员收藏" icon="user" onPress={() => navigation.navigate('FavoriteActors')} />
    {workspace.sample && <Line label="模拟发现页读取失败" icon="refresh-cw" onPress={() => {
      catalog.simulateListFailure();
      void client.invalidateQueries({ queryKey: queryKeys.catalogs, refetchType: 'none' });
      feedback('返回发现页后将模拟一次读取失败');
    }} />}
    <Line label="备份与恢复" icon="archive" onPress={() => navigation.navigate('Backup')} />
    <Line label="历史与云盘回执" icon="clock" onPress={() => navigation.navigate('Activity')} />
    <Line label="设置" icon="settings" onPress={() => navigation.navigate('Settings')} />
    </GroupedList>
  </ScrollView></Page>;
}
