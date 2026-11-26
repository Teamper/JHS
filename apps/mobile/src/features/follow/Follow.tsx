import { SegmentedControl } from '../../design/components/SegmentedControl.tsx';
import { useTabContentInset } from '../../design/components/ScreenScaffold.tsx';
import { useAppearance } from '../../design/appearance.ts';
import { useCallback, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LifecycleScope, parseBooleanSetting } from '@jhs/core';
import { FlashList } from '@shopify/flash-list';
import { Button, MovieTile, Page, Search, Status, errorText, styles } from '../../design/components/ui.tsx';
import { useApp } from '../../data/workspace/context.ts';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';
import { useRoot } from '../navigation.ts';
import { movieRef, type Movie } from '../../data/models/movie.ts';
import type { Decision } from '../../data/workspace/createWorkspace.ts';
import { actorKey } from '../../data/models/movie.ts';
import { scanFollow } from '../../data/catalog/scanFollow.ts';
import { FilterSheet } from '../../design/components/FilterSheet.tsx';
import { FilterChip } from '../../design/components/FilterChip.tsx';
import { useSettingsValue } from '../../data/queries/useThemeSetting.ts';

const queues = { pending: '待办', snoozed: '暂缓', dismissed: '已处理', ignored: '忽略' };

export function Follow() {
  const { workspace, catalog, feedback } = useApp();
  const { palette } = useAppearance();
  const navigation = useRoot();
  const bottomInset = useTabContentInset();
  const [status, setStatus] = useState<keyof typeof queues>('pending');
  const [query, search] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [actor, setActor] = useState('');
  const [actorDraft, setActorDraft] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const run = useRef<LifecycleScope | null>(null);
  const autoScan = useSettingsValue(workspace, snapshot => parseBooleanSetting(snapshot.enableCheckNewVideo, true));
  const focused = useScreenQuery(queryKeys.follow);
  const follow = useQuery({ queryKey: queryKeys.follow, queryFn: workspace.queue, enabled: focused });
  const actors = useQuery({ queryKey: queryKeys.actors, queryFn: workspace.actors, enabled: focused });
  const result = follow.data ?? [];
  const error = follow.error ? errorText(follow.error) : '';
  const selectedActor = actors.data?.find(item => actorKey(item) === actor);
  const rows = result.filter(row => row.status === status && (!selectedActor || row.starIds.includes(actorKey(selectedActor))) && (!query || [row.movie.title, row.movie.carNum, ...row.actors].some(
    value => value?.toLowerCase().includes(query.trim().toLowerCase()))));

  const scan = useCallback(async (force: boolean) => {
    if (run.current || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    const scope = run.current = new LifecycleScope('mobile-follow-scan');
    setScanning(true);
    setScanError('');
    try {
      const outcome = await scanFollow(workspace, catalog, scope, force);
      if (scope.disposed) return;
      const failed = outcome.parseFailed + outcome.networkFailed + outcome.unavailable;
      if (failed) {
        const saved = await workspace.actors();
        if (scope.disposed) return;
        const names = outcome.failures.flatMap(item => saved.find(actor => actorKey(actor) === item.id)?.name ?? []).slice(0, 3);
        setScanError(`${outcome.success} 位演员已更新，${failed} 位读取失败${names.length ? `（${names.join('、')}）` : ''}。已有待办已保留。`);
      }
      else if (force) feedback(outcome.success ? `已扫描 ${outcome.success} 位演员` : '请先收藏演员');
    } catch (failure) {
      if (!scope.disposed) setScanError(errorText(failure));
    } finally {
      scope.dispose();
      if (run.current === scope) {
        run.current = null;
        setScanning(false);
      }
    }
  }, [workspace, catalog, feedback]);

  useFocusEffect(useCallback(() => {
    setScanning(false);
    const tick = () => { if (autoScan && !workspace.sample) void scan(false); };
    tick();
    const interval = setInterval(tick, 60_000);
    const stop = () => {
      run.current?.dispose();
      run.current = null;
    };
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') tick();
      else { stop(); setScanning(false); }
    });
    return () => { stop(); clearInterval(interval); subscription.remove(); };
  }, [autoScan, scan, workspace.sample]));

  async function decide(movie: Movie, decision: Decision) {
    if (pending) return;
    setPending(movie.id);
    try {
      const update = await workspace.decide(movie, decision);
      if (update.transactionId) feedback(decision ? queues[decision] : '已恢复待办', update.transactionId);
    } catch (failure) { feedback(errorText(failure)); }
    finally { setPending(null); }
  }

  return <Page title="追新" subtitle={`${result.filter(row => row.status === 'pending').length} 部待处理`}>
    <View style={styles.controls}><Search value={query} onChange={search} placeholder="搜索追新作品或演员" />
      <SegmentedControl value={status} onChange={setStatus} options={(Object.entries(queues) as [keyof typeof queues, string][])
        .map(([value, label]) => ({ value, label }))} />
      <View style={styles.row}>
        <Button icon="user" selected={!!selectedActor} onPress={() => setActorDraft(selectedActor ? actor : '')}>
          {selectedActor?.name ?? '筛选演员'}
        </Button>
        <Button icon="refresh-cw" disabled={scanning} onPress={() => void scan(true)}>{scanning ? '扫描中' : '扫描新作'}</Button>
      </View>
    </View>
    <FlashList data={rows} keyExtractor={row => row.movie.carNum!} keyboardShouldPersistTaps="handled" onRefresh={() => void follow.refetch()} refreshing={follow.isRefetching}
      contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: bottomInset }}
      ListHeaderComponent={scanError ? <Status message={scanError} retry={() => void scan(true)} /> : null}
      ListEmptyComponent={<Status busy={follow.isPending} message={error || (follow.isPending ? '正在读取追新' : query ? '没有符合条件的作品' : '当前列表没有待处理作品')}
        retry={error ? () => void follow.refetch() : undefined} />}
      renderItem={({ item }) => <View testID={'follow-' + item.movie.carNum} style={[reviewStyles.card, { backgroundColor: palette.surface }]}>
        <MovieTile movie={item.movie} subtitle={item.actors.join('、')} list onPress={() => navigation.navigate('Work', movieRef(item.movie))} />
        <View style={reviewStyles.actions}>
          {status === 'pending' ? <>
            <Button variant="tonal" icon="check" disabled={!!pending} onPress={() => void decide(item.movie, 'dismissed')}>处理完成</Button>
            <Button variant="ghost" disabled={!!pending} onPress={() => void decide(item.movie, 'snoozed')}>暂缓一天</Button>
            <Button variant="ghost" disabled={!!pending} onPress={() => void decide(item.movie, 'ignored')}>忽略</Button>
          </> : <Button icon="rotate-ccw" disabled={!!pending} onPress={() => void decide(item.movie, null)}>恢复待办</Button>}
        </View>
      </View>} />
    {actorDraft !== null && <FilterSheet title="筛选演员" close={() => setActorDraft(null)}
      apply={() => { setActor(actorDraft); setActorDraft(null); }}>
      <View style={styles.row}>
        <FilterChip label="全部演员" selected={!actorDraft} onPress={() => setActorDraft('')} />
        {actors.data?.map(item => <FilterChip key={actorKey(item)} label={item.name} selected={actorDraft === actorKey(item)}
          onPress={() => setActorDraft(actorKey(item))} />)}
      </View>
      {actors.error && <Status message={errorText(actors.error)} retry={() => void actors.refetch()} />}
    </FilterSheet>}
  </Page>;
}

const reviewStyles = StyleSheet.create({
  card: { paddingHorizontal: 12, paddingBottom: 4, marginBottom: 12, borderRadius: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
});
