import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAbortError } from '@jhs/core';
import { siteNames } from '../../data/connections/AccountSessions.ts';
import { cloudSites, type Receipt } from '../../data/connections/CloudOperations.ts';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';
import { useApp } from '../../data/workspace/context.ts';
import { usePrivacy } from '../../design/appearance.ts';
import { AppBottomSheet } from '../../design/components/AppBottomSheet';
import { Body, Button, GroupedList, Line, Page, Status, errorText, styles } from '../../design/components/ui.tsx';
import { useRoot } from '../navigation.ts';
import { useAccount, useScreenSignal } from './useSession.ts';

export function CloudTasks() {
  const { connections, feedback } = useApp();
  const { accounts, cloud } = connections;
  const navigation = useRoot();
  const client = useQueryClient();
  const signal = useScreenSignal();
  const { masked } = usePrivacy();
  const one = useAccount('one115'), pan = useAccount('pan123');
  const states = { one115: one, pan123: pan };
  const [retry, setRetry] = useState<Receipt | null>(null);
  const focused = useScreenQuery(queryKeys.cloud);
  const query = useQuery({ queryKey: queryKeys.cloud, enabled: focused && accounts.available && !masked && !one.busy && !pan.busy, staleTime: 0,
    queryFn: ({ signal }) => connections.refreshTasks(true, signal) });
  const pending = !masked ? (cloud?.pending() ?? []).filter(receipt => !query.data?.[receipt.providerId]?.needsLogin) : [];
  const mutate = useMutation({
    async mutationFn(input: { receipt: Receipt; retry: boolean }) {
      const current = signal();
      const { receipt } = input;
      return input.retry ? cloud!.submit(receipt.providerId, receipt.resource, receipt.carNum, current, receipt)
        : cloud!.verify(receipt, current);
    },
    onSuccess: result => {
      feedback(result === false ? '尚未找到可核对的任务，请在原云盘确认。' : result === 'pending' ? '提交结果待确认' : '云盘任务已核实');
      void client.invalidateQueries({ queryKey: queryKeys.cloud });
    },
    onError: error => { if (!isAbortError(error) && !signal()?.aborted) feedback(errorText(error)); },
  });
  return <Page title="云盘任务" back>
    {!accounts.available ? <Status message="账号会话可用后即可查看真实云盘任务。" /> :
      masked ? <Status message="云盘任务已隐藏" /> :
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}><Button icon="refresh-cw" disabled={query.isFetching} onPress={() => void query.refetch()}>刷新任务</Button></View>
        {query.isPending && <Status busy={query.isFetching} message="正在核对云盘任务" />}
        {query.error && <Status message={errorText(query.error)} retry={() => void query.refetch()} />}
        {cloudSites.map(site => {
          const service = states[site].busy ? undefined : query.data?.[site];
          const enabled = service?.enabled ?? connections.enabled(site);
          return <View key={site} style={styles.section}>
            <Body bold size={17}>{siteNames[site]}</Body>
            <GroupedList>
              {service?.items.map(task => <View key={task.id} style={{ padding: 14, gap: 4 }}>
                <Body bold>{task.name || task.id}</Body>
                <Body muted size={13}>{[task.status, Number.isFinite(task.progress) ? task.progress + '%' : ''].filter(Boolean).join(' · ')}</Body>
              </View>)}
              {(!service?.items.length || service.reason) && <Body muted style={{ padding: 14 }}>{service?.reason || (enabled ? '暂无任务' : '离线服务已关闭')}</Body>}
              {(service?.needsLogin || enabled && !states[site].account) && <Line label={'连接 ' + siteNames[site]} icon="user" onPress={() => navigation.navigate('Accounts')} />}
            </GroupedList>
          </View>;
        })}
        {!!pending.length && <View style={styles.section}>
          <Body bold size={17}>待核实提交</Body>
          <GroupedList>{pending.map(receipt => <View key={receipt.attemptId} style={{ padding: 14, gap: 6 }}>
            <Body bold>{receipt.carNum + ' · ' + siteNames[receipt.providerId]}</Body>
            <View style={styles.row}>
              <Button disabled={mutate.isPending} onPress={() => mutate.mutate({ receipt, retry: false })}>核实任务</Button>
              <Button variant="ghost" disabled={mutate.isPending} onPress={() => setRetry(receipt)}>核实后重试</Button>
            </View>
          </View>)}</GroupedList>
        </View>}
      </ScrollView>}
    {retry && !masked && <AppBottomSheet open title="重新提交到原云盘？" close={() => setRetry(null)}>
      <Body bold>重新提交到原云盘？</Body>
      <Body muted>请先核对云盘中是否已有这条任务。继续时会再次验证账号及可识别的任务记录。</Body>
      <View style={styles.row}>
        <Button variant="ghost" onPress={() => setRetry(null)}>取消</Button>
        <Button primary onPress={() => { mutate.mutate({ receipt: retry, retry: true }); setRetry(null); }}>我已核对，重试</Button>
      </View>
    </AppBottomSheet>}
  </Page>;
}
