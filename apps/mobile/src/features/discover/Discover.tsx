import { useEffect, useMemo, useState } from 'react';
import { Linking, View, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { catalogOrigin, categories, rankings, periods, type CatalogPage, type CatalogQuery, type Facet } from '../../data/catalog/CatalogSource.ts';
import { actorKey, movieRef, type ActorRef, type Movie, type Source } from '../../data/models/movie.ts';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';
import { useApp } from '../../data/workspace/context.ts';
import { visibleActor, visibleWork } from '../../data/workspace/createWorkspace.ts';
import { usePrivacy } from '../../design/appearance.ts';
import { FilterChip } from '../../design/components/FilterChip.tsx';
import { FilterSheet } from '../../design/components/FilterSheet.tsx';
import { MovieRail } from '../../design/components/MovieRail.tsx';
import { SegmentedControl } from '../../design/components/SegmentedControl.tsx';
import { Skeleton } from '../../design/components/Skeleton.tsx';
import { useTabContentInset } from '../../design/components/ScreenScaffold.tsx';
import { Body, Button, Choices, Line, MovieTile, Page, Search, Status, errorText, styles, type Menu } from '../../design/components/ui.tsx';
import { columnsFor } from '../../design/tokens/metrics.ts';
import { ActorLine } from '../actor/Actors.tsx';
import { useRoot } from '../navigation.ts';
import { JhsError } from '@jhs/core';
import { useAccount, useScreenSignal } from '../cloud/useSession.ts';
import { useListPosition } from '../useListPosition.ts';

const sortOptions = { source: '来源顺序', date: '发行日期', rating: '评分优先' } as const;
type Sort = keyof typeof sortOptions;
type CatalogRow = Movie | ActorRef;
type Tags = Record<string, Facet>;
const isMovie = (item: CatalogRow): item is Movie => 'carNum' in item;
const rowKey = (item: CatalogRow) => isMovie(item) ? item.source + ':' + item.id : actorKey(item);

function options<T extends string>(values: Record<T, string>, choose: (value: T) => void) {
  return (Object.entries(values) as [T, string][]).map(([value, label]) => ({ label, run: () => choose(value) }));
}

export function Discover() {
  const { workspace, catalog, feedback, connections: { accounts } } = useApp();
  const account = useAccount('javdb');
  const screenSignal = useScreenSignal();
  const { masked } = usePrivacy();
  const navigation = useRoot();
  const bottomInset = useTabContentInset();
  const width = useWindowDimensions().width;
  const [source, setSource] = useState<Source>(workspace.sample ? 'sample' : 'javdb');
  const [text, setText] = useState('');
  const [section, setSection] = useState<CatalogQuery['section']>('latest');
  const [category, setCategory] = useState<keyof typeof categories>('all');
  const [ranking, setRanking] = useState<keyof typeof rankings>('top');
  const [period, setPeriod] = useState<keyof typeof periods>('weekly');
  const [mode, setMode] = useState<'movie' | 'actor'>('movie');
  const [tags, setTags] = useState<Tags>({});
  const [tagDraft, setTagDraft] = useState<Tags | null>(null);
  const [sort, setSort] = useState<Sort>('source');
  const [sortDraft, setSortDraft] = useState<Sort | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [searchText, setSearchText] = useState(text);
  useEffect(() => {
    const timeout = setTimeout(() => setSearchText(text.trim()), 175);
    return () => clearTimeout(timeout);
  }, [text]);
  const request = useMemo<CatalogQuery>(() => ({
    source, text: searchText, section, category, ranking, period, mode,
    tags: Object.fromEntries(Object.values(tags).map(({ key, value }) => [key, value])),
  }), [source, searchText, section, category, ranking, period, mode, tags]);
  const key = useMemo(() => queryKeys.catalog(request), [request]);
  const listKey = useMemo(() => [key, sort], [key, sort]);
  const focused = useScreenQuery(key);
  const position = useListPosition<CatalogRow>(listKey);
  const waitingForInput = searchText !== text.trim();
  const pages = useInfiniteQuery({
    queryKey: key, enabled: focused && !waitingForInput,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => catalog.list({ ...request, page: pageParam }, signal),
    getNextPageParam: last => last.next ?? undefined,
  });
  const rules = useQuery({ queryKey: queryKeys.visibility, queryFn: workspace.visibility, enabled: focused });
  const recent = useQuery({ queryKey: queryKeys.recent, queryFn: workspace.recent, enabled: focused && !masked });
  const facetRequest = useMemo<CatalogQuery>(() => ({
    source, category, text: '', section: 'latest', facets: true,
    tags: Object.fromEntries(Object.values(tagDraft ?? {}).map(({ key, value }) => [key, value])),
  }), [source, category, tagDraft]);
  const facetKey = useMemo(() => ['catalog', 'facets', facetRequest], [facetRequest]);
  useScreenQuery(facetKey);
  const facets = useQuery<CatalogPage>({
    queryKey: facetKey, enabled: focused && tagDraft !== null, placeholderData: previous => previous,
    queryFn: ({ signal }) => catalog.list(facetRequest, signal),
  });
  const actorView = searchText ? mode === 'actor' && (source === 'sample' || source === 'javdb') : section === 'ranking' && ranking === 'actors';
  const items = useMemo(() => {
    const visibility = rules.data;
    if (waitingForInput || !visibility) return [];
    if (actorView) {
      const rows = pages.data?.pages.flatMap(page => page.actors) ?? [];
      return [...new Map(rows.map(actor => [actorKey(actor), actor])).values()].filter(actor => visibleActor(visibility, actor));
    }
    const rows = pages.data?.pages.flatMap(page => page.items) ?? [];
    const movies = [...new Map(rows.map(movie => [rowKey(movie), movie])).values()].filter(movie => visibleWork(visibility, movie));
    if (sort === 'date') movies.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
    if (sort === 'rating') movies.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    return movies;
  }, [actorView, pages.data, rules.data, sort, waitingForInput]);
  const continueItems = !text && section === 'latest' && !masked && rules.data
    ? (recent.data ?? []).filter(item => visibleWork(rules.data!, item)) : [];
  const error = !waitingForInput && (pages.error || rules.error) ? errorText(pages.error || rules.error) : '';
  const retry = () => {
    if (rules.error) void rules.refetch();
    void (pages.isFetchNextPageError ? pages.fetchNextPage() : pages.refetch());
  };
  const problem = pages.error instanceof JhsError ? pages.error : null;
  const loginRequired = (source === 'javdb' || source === 'fc2') && problem?.code === 'AUTH_REQUIRED' && accounts.available;
  const loginAction = loginRequired && <Button disabled={account.busy} onPress={() => {
    const active = screenSignal();
    const verification = typeof problem.details?.url === 'string' && new URL(problem.details.url).pathname === '/doc/driver-verify'
      ? problem.details.url : undefined;
    void accounts.login('javdb', verification).then(result => {
      if (!active?.aborted) {
        if (result) retry();
        else feedback('完成原站登录后可接着浏览。');
      }
    }, error => { if (!active?.aborted) feedback(errorText(error)); });
  }}>登录 JavDB 后继续</Button>;
  const columns = actorView ? 1 : columnsFor(width);
  const hasCatalogModes = source === 'javdb' || source === 'sample';
  const availableFacets = [...new Map([...(facets.data?.facets ?? []), ...Object.values(tagDraft ?? {})].map(item => [item.key + '=' + item.value, item])).values()];

  function openWork(item: Movie) {
    position.remember();
    navigation.navigate('Work', movieRef(item));
  }

  function chooseSource(next: Source) {
    setSource(next);
    setMode('movie');
    setSection('latest');
    setTags({});
  }

  return <Page title="发现">
    <View style={styles.controls}>
      <Search value={text} onChange={setText} placeholder="搜索番号、标题或演员" />
      <View style={styles.row}>
        {hasCatalogModes && <View style={styles.fill}><SegmentedControl value={text.trim() ? mode : section}
          onChange={value => {
            if (value === 'actor' || value === 'movie') setMode(value);
            else setSection(value);
          }} options={text.trim() ? [{ value: 'movie', label: '作品' }, { value: 'actor', label: '演员' }]
            : [{ value: 'latest', label: '最新' }, { value: 'ranking', label: '榜单' }]} /></View>}
        {!workspace.sample && <Button icon="layers" onPress={() => setMenu({ title: '作品来源', actions: options(
          { javdb: 'JavDB', javbus: 'JavBus', fc2: 'FC2' }, value => chooseSource(value)) })}>
          {source === 'fc2' ? 'FC2' : source === 'javbus' ? 'JavBus' : 'JavDB'}</Button>}
      </View>
      <View style={styles.row}>
        {!text.trim() && section === 'latest' && hasCatalogModes && <Button icon="layers" onPress={() =>
          setMenu({ title: '作品分类', actions: options(categories, value => { setCategory(value); setTags({}); }) })}>
          {category === 'all' ? '分类' : categories[category]}
        </Button>}
        {!text.trim() && section === 'latest' && source !== 'javbus' && <Button icon="sliders" selected={Object.keys(tags).length > 0}
          onPress={() => setTagDraft(tags)}>{Object.keys(tags).length ? `标签筛选 ${Object.keys(tags).length}` : '标签筛选'}</Button>}
        {!text.trim() && section === 'ranking' && hasCatalogModes && <>
          <Button icon="list" onPress={() => setMenu({ title: '榜单类型', actions: options(rankings, value => setRanking(value)) })}>{rankings[ranking]}</Button>
          <Button onPress={() => setMenu({ title: '榜单周期', actions: options(periods, value => setPeriod(value)) })}>{periods[period]}</Button>
        </>}
        {!actorView && <Button icon="list" selected={sort !== 'source'} onPress={() => setSortDraft(sort)}>
          {sort === 'source' ? '排序' : sortOptions[sort]}
        </Button>}
      </View>
    </View>
    <FlashList ref={position.list} testID="discover-list"
      key={columns} data={items} numColumns={columns} keyExtractor={rowKey}
      onRefresh={() => void pages.refetch()} refreshing={pages.isRefetching}
      onEndReached={() => { if (pages.hasNextPage && !pages.isFetching && !error) void pages.fetchNextPage(); }} onEndReachedThreshold={0.4}
      keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 13, paddingBottom: bottomInset }}
      ListHeaderComponent={<View style={{ paddingHorizontal: 5, gap: 5, paddingBottom: 5 }}>
        {items.length > 0 && error && !pages.isFetchNextPageError && <Status message={error} retry={retry} />}
        {items.length > 0 && error && !pages.isFetchNextPageError && loginAction}
        <MovieRail title="继续浏览" items={continueItems} onPress={openWork} />
        {items.length > 0 && <Body bold size={19}>{text ? '搜索结果' : section === 'ranking' ? (actorView ? '演员榜单' : '作品榜单') : '最新收录'}</Body>}
      </View>}
      ListEmptyComponent={<View style={styles.section}>
        {waitingForInput || pages.isPending || rules.isPending ? <Skeleton columns={columns} /> : <Status message={error || '没有符合条件的结果'} retry={error ? retry : undefined} />}
        {loginAction}
        {error.includes('官方页面') && <Line label="打开官方页面" icon="external-link" onPress={() => {
          const url = catalogOrigin(source);
          if (url) void Linking.openURL(url).catch(failure => feedback(errorText(failure)));
        }} />}
      </View>}
      ListFooterComponent={items.length > 0 && (pages.isFetchingNextPage || pages.isFetchNextPageError) ? <View style={styles.section}>
        <Status busy={pages.isFetchingNextPage} message={error || '正在加载下一页'} retry={pages.isFetchNextPageError ? retry : undefined} />
        {pages.isFetchNextPageError && loginAction}
      </View> : null}
      renderItem={({ item }) => isMovie(item) ? <MovieTile movie={item} onPress={() => openWork(item)} />
        : <ActorLine actor={item} onPress={() => { position.remember(); navigation.navigate('ActorWorks', item); }} />} />
    <Choices menu={menu} close={() => setMenu(null)} />
    {tagDraft && <FilterSheet title="标签筛选" close={() => setTagDraft(null)} apply={() => { setTags(tagDraft); setTagDraft(null); }}>
      <View style={styles.row}>
        <FilterChip label="清除标签" selected={!Object.keys(tagDraft).length} onPress={() => setTagDraft({})} />
        {availableFacets.map(item => <FilterChip key={item.key + '=' + item.value} label={item.label} selected={tagDraft[item.key]?.value === item.value}
          onPress={() => setTagDraft(previous => {
            const next = { ...previous };
            if (next[item.key]?.value === item.value) delete next[item.key];
            else next[item.key] = item;
            return next;
          })} />)}
      </View>
      {facets.isPending && <Status busy message="正在读取标签" />}
      {facets.error && <Status message={errorText(facets.error)} retry={() => void facets.refetch()} />}
    </FilterSheet>}
    {sortDraft && <FilterSheet title="作品排序" close={() => setSortDraft(null)} apply={() => { setSort(sortDraft); setSortDraft(null); }}>
      <View style={styles.row}>
        {options(sortOptions, value => setSortDraft(value)).map(({ label, run }) => <FilterChip key={label} label={label} selected={label === sortOptions[sortDraft]} onPress={run} />)}
      </View>
    </FilterSheet>}
  </Page>;
}
