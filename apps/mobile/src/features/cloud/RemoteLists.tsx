import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { JhsError, isAbortError } from '@jhs/core';
import type { Routes } from '../../app/navigation/types.ts';
import { javdbVideo, type RemoteList } from '../../data/connections/JavDbActions.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';
import { useApp } from '../../data/workspace/context.ts';
import { usePrivacy } from '../../design/appearance.ts';
import { AppBottomSheet } from '../../design/components/AppBottomSheet';
import { Body, Button, GroupedList, Line, Page, Status, errorText, styles } from '../../design/components/ui.tsx';
import { SegmentedControl } from '../../design/components/SegmentedControl.tsx';
import { useRoot } from '../navigation.ts';
import { useAccount, useScreenSignal } from './useSession.ts';

const modes = [{ value: 'add', label: '加入' }, { value: 'remove', label: '移出' }] as const;

export function RemoteLists() {
  const { movies } = useRoute<RouteProp<Routes, 'RemoteLists'>>().params;
  const { connections: { accounts, javdb }, feedback } = useApp();
  const account = useAccount('javdb');
  const { masked } = usePrivacy();
  const signal = useScreenSignal();
  const navigation = useRoot();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [target, setTarget] = useState<RemoteList | null>(null);
  const id = movies.length === 1 ? javdbVideo(movies[0]) : null;
  const key = useMemo(() => ['javdb-lists', account.version, id], [account.version, id]);
  const focused = useScreenQuery(key);
  const query = useQuery({ queryKey: key, enabled: focused && accounts.available && !account.busy && !masked,
    queryFn: ({ signal }) => javdb.directory(id, signal) });
  const checked = movies.length === 1 ? !target?.checked : mode === 'add';
  const update = useMutation({
    mutationFn: ({ list, checked, fingerprint }: { list: RemoteList; checked: boolean; fingerprint: string }) =>
      javdb.update(movies, list, checked, fingerprint, signal()),
    onSuccess: result => {
      feedback(result.counts.unknown || result.counts.failed || result.counts.unstarted
        ? `已核实 ${result.counts.success} 部，其余作品待核对` : `原站已核实 ${result.counts.success} 部`);
      void query.refetch();
    },
    onError: error => { if (!isAbortError(error) && !signal()?.aborted) feedback(errorText(error)); },
  });
  const login = query.error instanceof JhsError && query.error.code === 'AUTH_REQUIRED';
  return <Page title="JavDB 个人清单" back>
    {masked ? <Status message="个人清单已隐藏" /> : <ScrollView contentContainerStyle={styles.content}>
      {!accounts.available && <Status message="当前环境使用本地清单。原站清单请在在线版中使用。" />}
      {accounts.available && (query.isPending || query.error) && <Status busy={query.isFetching} message={query.error ? errorText(query.error) : '正在读取原站清单'}
        retry={query.error && !login ? () => void query.refetch() : undefined} />}
      {login && <Button onPress={() => navigation.navigate('Accounts')}>连接 JavDB</Button>}
      {query.data && <>
        <Body muted size={13}>{query.data.account.label}</Body>
        {movies.length > 1 && <SegmentedControl value={mode} onChange={setMode} options={modes} />}
        <GroupedList>{query.data.items.map(list => {
          const status = [list.count === null ? '' : list.count + ' 部', id && list.checked ? '已加入' : ''].filter(Boolean).join(' · ');
          return movies.length && !list.disabled && !update.isPending
            ? <Line key={list.id} label={list.name} subtitle={status} icon="layers" onPress={() => setTarget(list)} />
            : <View key={list.id} style={{ padding: 14, gap: 4 }}><Body bold>{list.name}</Body>{!!status && <Body muted size={13}>{status}</Body>}</View>;
        })}</GroupedList>
        {!query.data.items.length && <Status message="暂无个人清单" />}
      </>}
    </ScrollView>}
    {target && query.data && !masked && <AppBottomSheet open title="确认修改原站清单" close={() => setTarget(null)}>
      <Body bold>{`${checked ? '加入' : '移出'}「${target.name}」`}</Body>
      <Body muted>{`${query.data.account.label} · ${movies.length} 部作品`}</Body>
      <View style={styles.row}>
        <Button variant="ghost" onPress={() => setTarget(null)}>取消</Button>
        <Button primary onPress={() => {
          update.mutate({ list: target, checked, fingerprint: query.data!.account.fingerprint });
          setTarget(null);
        }}>确认</Button>
      </View>
    </AppBottomSheet>}
  </Page>;
}
