import { FilterChip } from '../../design/components/FilterChip.tsx';
import { useTabContentInset } from '../../design/components/ScreenScaffold.tsx';
import { AppBottomSheet } from '../../design/components/AppBottomSheet';
import { FilterSheet } from '../../design/components/FilterSheet.tsx';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, View, useWindowDimensions } from 'react-native';
import { collections } from '@jhs/fixtures';
import { FlashList } from '@shopify/flash-list';
import { flags, movieRef, type LibraryQuery, type Movie, type MovieFlag } from '../../data/models/movie.ts';
import { Body, Button, Choices, Line, MovieTile, Page, Search, Status, errorText, styles, type Menu } from '../../design/components/ui.tsx';
import { useApp } from '../../data/workspace/context.ts';
import { useRoot } from '../navigation.ts';
import { javdbVideo } from '../../data/connections/JavDbActions.ts';
import { usePrivacy } from '../../design/appearance.ts';
import { useListPosition } from '../useListPosition.ts';

import { columnsFor } from '../../design/tokens/metrics.ts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';

type Filter = { flags: MovieFlag[]; collection?: string };
const collectionNames: Record<string, string> = Object.fromEntries(Object.entries(collections).map(([key, value]) => [key, value.name]));

export function Library() {
  const { workspace, feedback, connections } = useApp();
  const { masked } = usePrivacy();
  const navigation = useRoot();
  const bottomInset = useTabContentInset();
  const width = useWindowDimensions().width;
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<Filter>({ flags: [] });
  const [filterDraft, setFilterDraft] = useState<Filter | null>(null);
  const [sort, setSort] = useState<LibraryQuery['sort']>('updated');
  const [list, setList] = useState(true);
  const [selection, setSelection] = useState<Map<string, Movie> | null>(null);
  const [working, setWorking] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [remove, setRemove] = useState<'library' | 'collection' | null>(null);
  const request = useMemo(() => ({ text: text.trim(), ...filters, sort, includeCount: true }), [text, filters, sort]);
  const key = useMemo(() => queryKeys.libraryPage(request), [request]);
  const focused = useScreenQuery(key);
  const position = useListPosition<Movie>(key);
  const pages = useInfiniteQuery({
    queryKey: key, enabled: focused,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => workspace.database.queryMovies({ ...request, offset: pageParam }, signal),
    getNextPageParam: last => last.next ?? undefined,
  });
  const movies = useMemo(() => pages.data?.pages.flatMap(page => page.items) ?? [], [pages.data]);
  const error = pages.error ? errorText(pages.error) : '';
  const retry = () => { void (pages.isFetchNextPageError ? pages.fetchNextPage() : pages.refetch()); };
  const columns = list ? 1 : columnsFor(width);
  useEffect(() => {
    if (!focused || selection === null) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setSelection(null); return true; });
    return () => listener.remove();
  }, [focused, selection]);

  function select(movie: Movie) {
    setSelection(previous => {
      const next = new Map(previous);
      if (next.has(movie.id)) next.delete(movie.id);
      else next.set(movie.id, movie);
      return next;
    });
  }

  const total = pages.data?.pages[0]?.count;

  async function batch(action: (items: Movie[]) => Promise<{ changed: string[]; transactionId: string | null }>, message: string) {
    if (working || !selection?.size) return;
    setWorking(true);
    try {
      const result = await action([...selection.values()]);
      feedback(result.changed.length ? `${message} ${result.changed.length} 部作品` : '所选状态已是最新。', result.transactionId);
      setSelection(null);
    } catch (error) { feedback(errorText(error)); }
    finally { setWorking(false); }
  }

  function chooseBatch() {
    const selected = [...(selection?.values() ?? [])];
    setMenu({ title: `更新选中的 ${selection?.size ?? 0} 部作品`, actions: [
      ...([['favorite', '收藏'], ['watched', '标为已看'], ['downloaded', '标为已下载']] as const).map(([flag, label]) =>
        ({ label, run: () => void batch(items => workspace.mark(items, flag, true), '已更新') })),
      { label: '加入清单', run: () => setMenu({ title: '加入清单', actions: Object.entries(collectionNames).map(([key, label]) =>
        ({ label, run: () => void batch(items => workspace.changeCollection(items, key, true), '已加入') })) }) },
      ...(filters.collection ? [{ label: '移出当前清单', run: () => setRemove('collection') }] : []),
      ...(connections.accounts.available && !masked && selected.length && selected.every(javdbVideo) ?
        [{ label: 'JavDB 个人清单', run: () => navigation.navigate('RemoteLists', { movies: selected }) }] : []),
      { label: '移出片库', run: () => setRemove('library') },
    ] });
  }

  function toggleFlag(filter: Filter, flag: MovieFlag): Filter {
    return { ...filter, flags: filter.flags.includes(flag) ? filter.flags.filter(item => item !== flag) : [...filter.flags, flag] };
  }

  return <Page title="片库">
    <View style={styles.controls}>
      <Search value={text} onChange={query => { setText(query); setSelection(null); }} placeholder="搜索片库" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
        <FilterChip label="全部" selected={!filters.flags.length} onPress={() => { setFilters(previous => ({ ...previous, flags: [] })); setSelection(null); }} />
        {(Object.entries(flags) as [MovieFlag, string][]).map(([key, label]) => <FilterChip key={key} label={label} selected={filters.flags.includes(key)} onPress={() => {
          setFilters(previous => toggleFlag(previous, key)); setSelection(null);
        }} />)}
      </ScrollView>
      <View style={styles.row}>
        <Button icon="sliders" selected={!!filters.collection} onPress={() => setFilterDraft(filters)}>
          {filters.collection ? collectionNames[filters.collection] : '筛选'}
        </Button>
        <Button icon="list" onPress={() => setMenu({ title: '排序', actions: [
          { label: '最近更新', run: () => setSort('updated') }, { label: '发行日期', run: () => setSort('date') },
          { label: '番号', run: () => setSort('code') },
        ] })}>{sort === 'updated' ? '最近更新' : sort === 'date' ? '发行日期' : '番号'}</Button>
        <Button icon={list ? 'grid' : 'align-justify'} onPress={() => setList(value => !value)}>{list ? '海报' : '列表'}</Button>
        <Button icon="check-square" selected={selection !== null} onPress={() => setSelection(selection ? null : new Map())}>{selection ? '完成选择' : '多选'}</Button>
      </View>
      {!!selection && <View style={styles.row}><Body muted>已选 {selection.size} 部</Body>
        <Button primary disabled={!selection.size || working} onPress={chooseBatch}>批量标记</Button></View>}
      {!selection && total !== undefined && <Body muted size={13}>{total} 部作品</Body>}
    </View>
    <FlashList ref={position.list} key={columns}
      data={movies} numColumns={columns} keyExtractor={item => item.id}
      onRefresh={() => void pages.refetch()} refreshing={pages.isRefetching}
      onEndReached={() => { if (pages.hasNextPage && !pages.isFetching && !error) void pages.fetchNextPage(); }} onEndReachedThreshold={0.4} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: list ? 18 : 13, paddingBottom: bottomInset }}
      ListEmptyComponent={<View style={styles.section}><Status busy={pages.isPending} message={pages.isPending ? '正在读取片库' : error || '这里还没有作品'} retry={error ? retry : undefined} />
        {!pages.isPending && !error && !text && !filters.flags.length && !filters.collection && <Line label="导入备份" icon="upload" onPress={() => navigation.navigate('Backup')} />}</View>}
      ListFooterComponent={movies.length > 0 && error ? <Status message={error} retry={retry} /> : null}
      renderItem={({ item }) => <MovieTile movie={item} list={list} subtitle={list ? item.remark : undefined} selected={selection?.has(item.id)} onLongPress={() => select(item)}
        onPress={() => {
          if (selection) select(item);
          else {
            position.remember();
            navigation.navigate('Work', movieRef(item));
          }
        }} />} />
    <Choices menu={menu} close={() => setMenu(null)} />
    {filterDraft && <FilterSheet title="片库筛选" close={() => setFilterDraft(null)}
      apply={() => { setFilters(filterDraft); setFilterDraft(null); setSelection(null); }}>
      <Body bold>作品状态</Body>
      <View style={styles.row}>
        {(Object.entries(flags) as [MovieFlag, string][]).map(([key, label]) => <FilterChip key={key} label={label} selected={filterDraft.flags.includes(key)}
          onPress={() => setFilterDraft(toggleFlag(filterDraft, key))} />)}
      </View>
      <Body bold>清单</Body>
      <View style={styles.row}>
        <FilterChip label="全部清单" selected={!filterDraft.collection} onPress={() => setFilterDraft({ ...filterDraft, collection: undefined })} />
        {Object.entries(collectionNames).map(([value, label]) => <FilterChip key={value} label={label} selected={filterDraft.collection === value}
          onPress={() => setFilterDraft({ ...filterDraft, collection: value })} />)}
      </View>
    </FilterSheet>}
    {remove && <AppBottomSheet open title={remove === 'library' ? '移出片库' : '移出清单'} close={() => setRemove(null)}>
      <Body bold size={18}>移出选中的 {selection?.size ?? 0} 部作品？</Body>
      <View style={[styles.row, { justifyContent: 'flex-end' }]}>
        <Button variant="ghost" onPress={() => setRemove(null)}>取消</Button>
        <Button variant="danger" onPress={() => {
          const collection = remove === 'collection' ? filters.collection : undefined;
          setRemove(null);
          void batch(items => collection ? workspace.changeCollection(items, collection, false) : workspace.removeWorks(items), '已移出');
        }}>确认移出</Button>
      </View>
    </AppBottomSheet>}
  </Page>;
}
