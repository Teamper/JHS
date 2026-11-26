import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { StackActions, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { JhsError, getMovieStateEligibility, isAbortError } from '@jhs/core';
import { collections } from '@jhs/fixtures';
import type { Routes } from '../../app/navigation/types.ts';
import { flags, movieFromRef, movieRef, type Magnet, type Movie, type MovieFlag } from '../../data/models/movie.ts';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';
import { useTranslatedTitle } from '../../data/queries/useTranslatedTitle.ts';
import { useApp } from '../../data/workspace/context.ts';
import { visibleWork } from '../../data/workspace/createWorkspace.ts';
import { useAppearance, usePrivacy } from '../../design/appearance.ts';
import { AppBottomSheet, SheetTextInput } from '../../design/components/AppBottomSheet';
import { coverUri } from '../../design/components/MovieCard.tsx';
import { MovieRail } from '../../design/components/MovieRail.tsx';
import { SegmentedControl } from '../../design/components/SegmentedControl.tsx';
import { Body, Button, Choices, Cover, Icon, Line, Page, Status, errorText, styles as shared, type Menu } from '../../design/components/ui.tsx';
import { dark } from '../../design/tokens/palette.ts';
import { useRoot } from '../navigation.ts';
import { javdbVideo } from '../../data/connections/JavDbActions.ts';
import { siteNames } from '../../data/connections/AccountSessions.ts';
import { cloudSites, type CloudSite } from '../../data/connections/CloudOperations.ts';
import { useScreenSignal } from '../cloud/useSession.ts';

const sections = ['资料', '媒体', '来源'].map(value => ({ value, label: value }));
const icons = { favorite: 'bookmark', downloaded: 'download', watched: 'check', blocked: 'slash' } as const;
type Edit = { flag: MovieFlag; selected: boolean } | { remark: string } | { rating: number | null } | { collection: string; selected: boolean };

export function Work() {
  const ref = useRoute<RouteProp<Routes, 'Work'>>().params;
  const fallback = useMemo(() => movieFromRef(ref), [ref]);
  const { workspace, catalog, feedback, connections } = useApp();
  const signal = useScreenSignal();
  const queryClient = useQueryClient();
  const { palette } = useAppearance();
  const { masked } = usePrivacy();
  const navigation = useRoot();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState('资料');
  const [remark, setRemark] = useState('');
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<'rating' | 'collection' | null>(null);
  const [magnet, setMagnet] = useState<Magnet | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [watched, setWatched] = useState(false);
  const visited = useRef('');
  const key = useMemo(() => queryKeys.detail(ref), [ref]);
  const focused = useScreenQuery(key);
  const detail = useQuery({
    queryKey: key, enabled: focused, placeholderData: fallback,
    queryFn: ({ signal }) => catalog.detail(fallback, signal),
  });
  const details = detail.data ?? fallback;
  const title = useTranslatedTitle(details.title);
  const canEdit = !!details.carNum && (details.stateEligibility ?? getMovieStateEligibility(details)).eligible;
  const saved = useQuery({
    queryKey: queryKeys.movie(details.carNum), enabled: focused && !!details.carNum,
    queryFn: async () => {
      const [record, ratings] = await Promise.all([workspace.state.getState(details.carNum), workspace.state.getPersonalRatings()]);
      return { record, rating: details.carNum ? ratings[details.carNum]?.rating ?? null : null };
    },
  });
  const rules = useQuery({ queryKey: queryKeys.visibility, queryFn: workspace.visibility, enabled: focused });
  const related = !masked && rules.data ? details.related?.filter(item => visibleWork(rules.data!, item)) ?? [] : [];
  const update = useMutation({
    mutationFn: (change: Edit) => {
      if ('flag' in change) return workspace.toggle(details, change.flag);
      if ('rating' in change) return workspace.state.setPersonalRating(details.carNum!, change.rating);
      if ('collection' in change) return workspace.changeCollection([details], change.collection, change.selected);
      return workspace.saveRemark(details, change.remark);
    },
    onError: error => feedback(errorText(error)),
  });
  const pending = update.isPending ? update.variables : undefined;
  const artwork = !masked && coverUri(details);
  const membership = saved.data?.record?.collectionMembership;
  const rating = saved.data?.rating;
  const remote = connections.accounts.available && canEdit && !!javdbVideo(details);

  const review = useMutation({
    mutationFn: ({ kind, score }: { kind: 'want' | 'watched'; score: number }) => connections.javdb.review(details, kind, score, signal()),
    onSuccess: message => { if (!signal()?.aborted) feedback(message); },
    onError: error => {
      if (isAbortError(error) || signal()?.aborted) return;
      feedback(errorText(error));
      if ((error instanceof JhsError && error.code === 'AUTH_REQUIRED') || /登录 JavDB/.test(errorText(error))) {
        setMenu({ title: '连接 JavDB', actions: [{ label: '账号连接', run: () => navigation.navigate('Accounts') }] });
      }
    },
  });
  const offline = useMutation({
    mutationFn: ({ site, magnet }: { site: CloudSite; magnet: Magnet }) => connections.cloud!.submit(site, magnet.uri, details.carNum!, signal()),
    onSuccess: result => {
      if (!signal()?.aborted) feedback(result === 'pending' ? '提交待确认，请到云盘任务核实' : result === 'already' ? '这条任务已有提交回执' : '已提交云盘离线任务');
      void queryClient.invalidateQueries({ queryKey: queryKeys.cloud });
    },
    onError: error => {
      if (isAbortError(error) || signal()?.aborted) return;
      feedback(errorText(error));
      if (error instanceof JhsError && error.code === 'AUTH_REQUIRED') {
        setMenu({ title: '核对云盘授权', actions: [{ label: '账号连接', run: () => navigation.navigate('Accounts') }] });
      }
    },
  });

  function sendToCloud(item: Magnet) {
    const sites = cloudSites.filter(connections.enabled);
    const submit = (site: CloudSite) => offline.mutate({ site, magnet: item });
    if (sites.length === 1) submit(sites[0]);
    else setMenu(sites.length ? { title: '选择离线服务', actions: sites.map(site => ({ label: siteNames[site], run: () => submit(site) })) }
      : { title: '请先启用离线服务', actions: [{ label: '前往设置', run: () => navigation.navigate('Settings') }] });
  }

  useEffect(() => {
    if (!focused || masked || detail.isPlaceholderData || visited.current === details.id) return;
    visited.current = details.id;
    void workspace.visit(details).catch(() => { /* Recent browsing does not interrupt an open work. */ });
  }, [detail.isPlaceholderData, details, focused, masked, workspace]);

  async function openSource() {
    try { await Linking.openURL(catalog.sourcePage(details)); }
    catch (error) { feedback(errorText(error)); }
  }

  async function copyMagnet(item: Magnet) {
    try {
      if (!await setStringAsync(item.uri)) throw new Error('无法写入剪贴板。');
      setMagnet(null);
      feedback('磁力链接已复制');
    } catch (error) { feedback(errorText(error)); }
  }

  return <Page title="作品详情" back overlayHeader>
    <ScrollView testID="work-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      {artwork && <View pointerEvents="none" style={styles.atmosphere}>
        <Image source={{ uri: artwork }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={36}
          transition={0} cachePolicy="memory-disk" accessible={false} />
        <LinearGradient colors={[palette.canvas + '66', palette.canvas + 'CC', palette.canvas]} style={StyleSheet.absoluteFill} />
      </View>}
      <View style={styles.content}>
        <View style={shared.section}>
          <Pressable accessibilityRole="button" accessibilityLabel="查看封面" disabled={!artwork} onPress={() => {
            if (artwork) navigation.navigate('Gallery', { images: [artwork], index: 0 });
          }}><Cover movie={details} hero /></Pressable>
          <Body size={26} bold>{masked ? '已隐藏的作品' : title}</Body>
          {!masked && <Body muted size={13} tabular>{[details.carNum, details.releaseDate,
            details.rating === undefined ? '' : '评分 ' + details.rating.toFixed(1) + (details.voteCount ? `（${details.voteCount} 人）` : ''),
            details.subtitle && '含字幕'].filter(Boolean).join(' · ')}</Body>}
          <View style={styles.flags}>
            {(Object.entries(flags) as [MovieFlag, string][]).map(([flag, label]) => {
              const selected = !!saved.data?.record?.stateFlags?.[flag];
              return <Button key={flag} icon={width >= 365 ? icons[flag] : undefined} style={styles.flag}
                selected={pending && 'flag' in pending && pending.flag === flag ? pending.selected : selected}
                disabled={!canEdit || update.isPending} onPress={() => update.mutate({ flag, selected: !selected }, {
                  onSuccess: result => { if (result.transactionId) feedback('已保存片库标记', result.transactionId); },
                })}>{label}</Button>;
            })}
          </View>
          {!canEdit && <Body size={13} muted>确认作品番号后可使用片库标记。</Body>}
        </View>
        <SegmentedControl value={tab} onChange={setTab} options={sections} />
        {tab === '资料' && <View style={shared.section}>
          <View style={shared.row}>
            <Button icon="edit-2" disabled={!canEdit || masked || saved.isPending || update.isPending} onPress={() => setSheet('rating')}>
              {rating ? `我的评分 ${rating} 星` : '我的评分'}
            </Button>
            <Button icon="layers" disabled={!canEdit || masked || saved.isPending || update.isPending} onPress={() => setSheet('collection')}>管理清单</Button>
          </View>
          {remote && !masked && <View style={shared.row}>
            <Button disabled={review.isPending} onPress={() => review.mutate({ kind: 'want', score: 0 })}>JavDB 想看</Button>
            <Button disabled={review.isPending} onPress={() => setWatched(true)}>JavDB 看过</Button>
            <Button onPress={() => navigation.navigate('RemoteLists', { movies: [details] })}>个人清单</Button>
          </View>}
          {!!details.actors?.length && !masked && <View style={[styles.info, { backgroundColor: palette.surface }]}>
            <Body bold>演员</Body>
            {details.cast?.length ? <View style={shared.row}>{details.cast.map(actor => actor.id
              ? <Button key={actor.source + ':' + actor.id} icon="user" onPress={() => navigation.navigate('ActorWorks', { ...actor, id: actor.id! })}>{actor.name}</Button>
              : <Body key={actor.name}>{actor.name}</Body>)}</View> : <Body>{details.actors.join('、')}</Body>}
          </View>}
          {!!details.fields?.length && !masked && <View style={[styles.info, { backgroundColor: palette.surface }]}>
            <Body bold>发行资料</Body>
            {details.fields.map((field, index) => <View key={field.label + index} style={styles.field}>
              <Body muted size={13} style={styles.fieldName}>{field.label.replace(/[:：]$/, '')}</Body>
              <Body style={styles.fieldValue}>{field.value}</Body>
            </View>)}
          </View>}
          <View style={[styles.info, { backgroundColor: palette.surface }]}>
            <Body bold>备注</Body>
            <Body muted>{masked ? '备注已隐藏' : saved.data?.record?.remark || '暂无备注'}</Body>
            <View style={shared.row}><Button variant="tonal" icon="edit-2" disabled={!canEdit || masked} onPress={() => {
              setRemark(saved.data?.record?.remark ?? '');
              setEditing(true);
            }}>编辑备注</Button></View>
          </View>
          <MovieRail title="相关作品" items={related} onPress={movie => navigation.dispatch(StackActions.push('Work', movieRef(movie)))} />
        </View>}
        {tab === '媒体' && (masked ? <Status message="媒体已隐藏" /> : <MediaStrip movie={details}
          openImage={index => navigation.navigate('Gallery', { images: details.images!, index })} />)}
        {tab === '来源' && <View style={shared.section}>
          {details.url && !workspace.sample && !masked && <Line label="打开来源页面" icon="external-link" subtitle={details.source}
            onPress={() => void openSource()} />}
          {workspace.sample && <Body muted>此作品来自内置样片。</Body>}
          {!masked && !!details.magnets?.length && <View style={shared.section}>
            <Body bold size={18}>公开磁力</Body>
            {details.magnets.map(item => <View key={item.uri} style={[styles.info, { backgroundColor: palette.surface }]}>
              <Body bold>{item.name || '磁力链接'}</Body>
              {!!(item.meta || item.subtitle) && <Body muted size={13}>{[item.meta, item.subtitle && '含字幕'].filter(Boolean).join(' · ')}</Body>}
              <View style={shared.row}>
                <Button onPress={() => setMagnet(item)}>预览链接</Button>
                <Button variant="tonal" onPress={() => void copyMagnet(item)}>复制磁力</Button>
                {connections.cloud && canEdit && <Button primary disabled={offline.isPending} onPress={() => sendToCloud(item)}>云盘离线</Button>}
              </View>
            </View>)}
          </View>}
        </View>}
        {!workspace.sample && detail.isFetching && detail.isPlaceholderData && <Status busy message="正在补充来源资料" />}
        {detail.error && <Status message={errorText(detail.error)} retry={() => void detail.refetch()} />}
        {saved.error && <Status message={errorText(saved.error)} retry={() => void saved.refetch()} />}
      </View>
    </ScrollView>
    {editing && !masked && <AppBottomSheet open title="编辑备注" close={() => { if (!update.isPending) setEditing(false); }}>
      <Body bold size={18}>编辑备注</Body>
      <SheetTextInput accessibilityLabel="作品备注" placeholder="输入备注" placeholderTextColor={palette.textTertiary}
        value={remark} onChangeText={setRemark} editable={!update.isPending} multiline
        style={[styles.note, { borderColor: palette.hairline, backgroundColor: palette.surfaceRecessed, color: palette.textPrimary }]} />
      <View style={styles.sheetActions}>
        <Button variant="ghost" disabled={update.isPending} onPress={() => setEditing(false)}>取消</Button>
        <Button primary disabled={update.isPending} onPress={() => update.mutate({ remark: remark.trim() }, {
          onSuccess: result => { setEditing(false); if (result.transactionId) feedback('备注已保存', result.transactionId); },
        })}>保存备注</Button>
      </View>
      {update.error && <Body muted>{errorText(update.error)}</Body>}
    </AppBottomSheet>}
    {sheet && !masked && <AppBottomSheet open title={sheet === 'rating' ? '我的评分' : '管理清单'} close={() => setSheet(null)}>
      <Body bold size={18}>{sheet === 'rating' ? '我的评分' : '管理清单'}</Body>
      {sheet === 'rating' ? <View style={shared.row}>
        {[1, 2, 3, 4, 5, null].map(value => <Button key={String(value)} selected={rating === value} disabled={update.isPending} onPress={() => {
          setSheet(null);
          update.mutate({ rating: value }, { onSuccess: result => { if (result.transactionId) feedback('评分已保存', result.transactionId); } });
        }}>{value ? `${value} 星` : '清除评分'}</Button>)}
      </View> : Object.entries(collections).map(([key, list]) => <Button key={key} selected={membership?.[key] === true}
        disabled={update.isPending} onPress={() => {
          const selected = membership?.[key] !== true;
          setSheet(null);
          update.mutate({ collection: key, selected }, { onSuccess: result => {
            if (result.transactionId) feedback(selected ? '已加入清单' : '已移出清单', result.transactionId);
          } });
        }}>{list.name}</Button>)}
      <Button variant="ghost" onPress={() => setSheet(null)}>取消</Button>
    </AppBottomSheet>}
    {magnet && !masked && <AppBottomSheet open title="磁力预览" close={() => setMagnet(null)}>
      <Body bold size={18}>{magnet.name || '磁力链接'}</Body>
      <Text selectable style={{ color: palette.textSecondary }}>{magnet.uri}</Text>
      <Button primary onPress={() => void copyMagnet(magnet)}>复制磁力</Button>
    </AppBottomSheet>}
    {watched && !masked && <AppBottomSheet open title="标记 JavDB 看过" close={() => setWatched(false)}>
      <Body bold>选择原站评分</Body>
      <View style={shared.row}>{[1, 2, 3, 4, 5].map(score => <Button key={score} onPress={() => {
        setWatched(false);
        review.mutate({ kind: 'watched', score });
      }}>{score + ' 星'}</Button>)}</View>
      <Button variant="ghost" onPress={() => setWatched(false)}>取消</Button>
    </AppBottomSheet>}
    {!masked && <Choices menu={menu} close={() => setMenu(null)} />}
  </Page>;
}

function MediaStrip({ movie, openImage }: { movie: Movie; openImage: (index: number) => void }) {
  const { catalog } = useApp();
  const { palette, reduceMotion } = useAppearance();
  const [visible, setVisible] = useState(false);
  const key = useMemo(() => ['catalog', 'trailer', movie.source, movie.id], [movie.id, movie.source]);
  const focused = useScreenQuery(key);
  const video = useQuery({ queryKey: key, queryFn: ({ signal }) => catalog.trailer(movie, signal), enabled: visible && focused });
  const canPlay = !!(movie.trailer || movie.previewRequest);
  const poster = movie.trailerPoster ?? coverUri(movie);
  const images = movie.images ?? [];
  if (!canPlay && !images.length) return <Body muted>此来源暂无可用媒体。</Body>;
  return <View style={shared.section}>
    <Body bold>{canPlay ? images.length ? '预告与剧照' : '预告' : '剧照'}</Body>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stills}>
      {canPlay && <Pressable accessibilityRole="button" accessibilityLabel={visible ? '收起预告' : movie.source === 'sample' ? '播放预告样片' : '播放公开预告'}
        onPress={() => setVisible(previous => !previous)} style={[styles.still, styles.preview, { backgroundColor: palette.surfaceElevated }]}>
        {poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} accessible={false} />}
        <View style={[StyleSheet.absoluteFill, styles.preview, { backgroundColor: dark.scrim }]}>
          <Icon name="play-circle" size={23} color={dark.textPrimary} />
          <Body size={12} bold style={{ color: dark.textPrimary }}>预告</Body>
        </View>
      </Pressable>}
      {images.map((image, index) => {
        const thumbnail = movie.stills?.[index]?.thumbnail ?? image;
        return <Pressable accessibilityRole="button" accessibilityLabel={'查看第 ' + (index + 1) + ' 张剧照'} key={image + index}
          onPress={() => openImage(index)} style={[styles.still, { backgroundColor: palette.surface }]}>
          <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={reduceMotion || thumbnail.startsWith('data:') ? 0 : 140} />
        </Pressable>;
      })}
    </ScrollView>
    {visible && focused && (video.data ? <Video source={video.data === 'sample' ? require('@jhs/fixtures/trailer.mp4') : video.data} />
      : <Status busy={video.isPending} message={video.error ? errorText(video.error) : '正在读取预告'}
        retry={video.error ? () => void video.refetch() : undefined} />)}
  </View>;
}

function Video({ source }: { source: string | number }) {
  const player = useVideoPlayer(source);
  return <VideoView player={player} nativeControls fullscreenOptions={{ enable: true }} style={styles.video} />;
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 86, paddingBottom: 24 },
  atmosphere: { position: 'absolute', left: 0, top: 0, right: 0, height: 330, overflow: 'hidden' },
  content: { alignSelf: 'center', width: '100%', maxWidth: 720, paddingHorizontal: 16, gap: 16 },
  flags: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  flag: { flex: 1, paddingHorizontal: 5 },
  info: { padding: 15, gap: 9, borderRadius: 16 },
  field: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fieldName: { width: 64 },
  fieldValue: { flex: 1 },
  stills: { gap: 10, paddingVertical: 4 },
  still: { width: 106, height: 69, borderRadius: 10, overflow: 'hidden' },
  preview: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  note: { minHeight: 110, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  video: { width: '100%', aspectRatio: 1.65, borderRadius: 10 },
});
