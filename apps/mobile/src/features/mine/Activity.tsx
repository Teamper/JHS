import { usePrivacy } from '../../design/appearance.ts';
import { useState } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Body, Button, Page, Status, errorText, styles } from '../../design/components/ui.tsx';
import { useApp } from '../../data/workspace/context.ts';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';

export function Activity() {
  const { workspace, feedback } = useApp();
  const { masked } = usePrivacy();
  const [tab, setTab] = useState<'notes' | 'cloud'>('notes');
  const key = tab === 'notes' ? queryKeys.activity : queryKeys.cloud;
  const focused = useScreenQuery(key);
  const history = useQuery({
    queryKey: key, enabled: focused,
    queryFn: async () => tab === 'notes' ? (await workspace.state.getActivityLog()).entries : workspace.state.getOfflineHistory(),
  });
  const values = history.data ?? [];

  return <Page title="操作记录" back>
    <View style={[styles.controls, styles.row]}><Button selected={tab === 'notes'} onPress={() => setTab('notes')}>片库记录</Button>
      <Button selected={tab === 'cloud'} onPress={() => setTab('cloud')}>云盘回执</Button></View>
    <FlashList data={[...values].reverse()} keyExtractor={(row, index) => row.id ?? String(index)}
      contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
      ListEmptyComponent={<Status busy={history.isPending} message={history.error ? errorText(history.error) : history.isPending ? '正在读取操作记录' : '这里还没有记录'} />}
      renderItem={({ item }) => <View style={{ gap: 4, paddingVertical: 10 }}>
        <Body bold>{masked ? '详情已隐藏' : tab === 'notes' ? (item.changes ?? []).map((change: { carNum: string }) => change.carNum).slice(0, 5).join(' · ') || '片库修改'
          : [item.providerName, item.carNum, item.submissionOutcome === 'unknown' ? '待核实' : item.submissionOutcome].filter(Boolean).join(' · ')}</Body>
        <Body muted size={13}>{typeof item.createdAt === 'string' ? item.createdAt.slice(0, 16).replace('T', ' ') : ''}</Body>
        {tab === 'notes' && item.changes?.some((change: { undoState: string }) => change.undoState === 'pending') && <View style={styles.row}>
          <Button onPress={() => void workspace.state.undoTransaction(item.id).then(result => {
            feedback(result.reverted.length ? `已撤销 ${result.reverted.length} 项` : '这条记录当前不可撤销。');
          }, failure => feedback(errorText(failure)))}>撤销</Button>
        </View>}
      </View>} />
  </Page>;
}
