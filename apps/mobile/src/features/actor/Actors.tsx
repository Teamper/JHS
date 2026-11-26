import { useMemo } from 'react';
import { View } from 'react-native';
import { StackActions, useRoute, type RouteProp } from '@react-navigation/native';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import type { Routes } from '../../app/navigation/types.ts';
import { actorKey, movieRef, type ActorRef, type Movie } from '../../data/models/movie.ts';
import { queryKeys } from '../../data/queries/queryKeys.ts';
import { useScreenQuery } from '../../data/queries/useScreenQueries.ts';
import { useApp } from '../../data/workspace/context.ts';
import { visibleActor, visibleWork } from '../../data/workspace/createWorkspace.ts';
import { usePrivacy } from '../../design/appearance.ts';
import { Body, Button, Line, MovieTile, Page, Status, errorText, styles } from '../../design/components/ui.tsx';
import { useRoot } from '../navigation.ts';
import { useListPosition } from '../useListPosition.ts';

export function ActorLine({ actor, onPress }: { actor: ActorRef; onPress: () => void }) {
  const { masked } = usePrivacy();
  return <Line label={masked ? '已隐藏的演员' : actor.name} icon="user" onPress={onPress} />;
}

export function FavoriteActors() {
  const { workspace } = useApp();
  const navigation = useRoot();
  const focused = useScreenQuery(queryKeys.actors);
  const actors = useQuery({ queryKey: queryKeys.actors, queryFn: workspace.actors, enabled: focused });
  return <Page title="演员收藏" back>
    <FlashList data={actors.data ?? []} keyExtractor={actorKey} contentContainerStyle={{ paddingHorizontal: 16 }}
      ListEmptyComponent={<Status busy={actors.isPending} message={actors.error ? errorText(actors.error) : actors.isPending ? '正在读取演员收藏' : '还没有收藏演员'}
        retry={actors.error ? () => void actors.refetch() : undefined} />}
      renderItem={({ item }) => <ActorLine actor={item} onPress={() => navigation.navigate('ActorWorks', item)} />} />
  </Page>;
}

export function ActorWorks() {
  const actor = useRoute<RouteProp<Routes, 'ActorWorks'>>().params;
  const navigation = useRoot();
  const { workspace, catalog, feedback } = useApp();
  const { masked } = usePrivacy();
  const key = useMemo(() => queryKeys.actor(actor.source, actor.id), [actor.id, actor.source]);
  const focused = useScreenQuery(key);
  const position = useListPosition<Movie>(key);
  const pages = useInfiniteQuery({
    queryKey: key, initialPageParam: 1, enabled: focused,
    queryFn: ({ pageParam, signal }) => catalog.actor(actor, pageParam, signal),
    getNextPageParam: last => last.next ?? undefined,
  });
  const rules = useQuery({ queryKey: queryKeys.visibility, queryFn: workspace.visibility, enabled: focused });
  const saved = useQuery({ queryKey: queryKeys.actors, queryFn: workspace.actors, enabled: focused });
  const profile = pages.data?.pages[0]?.profile;
  const isSaved = saved.data?.some(item => actorKey(item) === actorKey(actor));
  const hiddenActor = rules.data && !visibleActor(rules.data, actor);
  const items = rules.data && !hiddenActor ? [...new Map(pages.data?.pages.flatMap(page => page.items.map(movie => [movie.id, movie]))).values()]
    .filter(movie => visibleWork(rules.data!, movie)) : [];
  const update = useMutation({
    mutationFn: (saveProfile: boolean) => saveProfile && profile ? workspace.saveActorProfile(profile) : workspace.favoriteActor(profile ?? actor, !isSaved),
    onError: error => feedback(errorText(error)),
  });
  const error = pages.error ?? rules.error ?? saved.error;
  const pending = pages.isPending || rules.isPending || saved.isPending;
  const retry = () => {
    if (rules.error) void rules.refetch();
    if (saved.error) void saved.refetch();
    void (pages.isFetchNextPageError ? pages.fetchNextPage() : pages.refetch());
  };

  return <Page title="演员作品" back>
    <View style={styles.controls}>
      <Body size={24} bold>{masked ? '已隐藏的演员' : profile?.name ?? actor.name}</Body>
      {!masked && profile && profile.names.length > 1 && <Body muted>{profile.names.slice(1).join('、')}</Body>}
      <View style={styles.row}>
        <Button icon="bookmark" selected={isSaved} disabled={masked || saved.isPending || !!saved.error || update.isPending}
          onPress={() => update.mutate(false, { onSuccess: () => feedback(isSaved ? '已取消收藏演员' : '已收藏演员') })}>
          {isSaved ? '取消收藏演员' : '收藏演员'}
        </Button>
        {isSaved && profile && <Button disabled={masked || update.isPending} onPress={() => update.mutate(true, { onSuccess: () => feedback('演员资料已保存') })}>
          保存演员资料
        </Button>}
      </View>
    </View>
    <FlashList ref={position.list} data={items} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 16 }}
      onEndReached={() => { if (pages.hasNextPage && !pages.isFetching && !error && !hiddenActor) void pages.fetchNextPage(); }}
      ListEmptyComponent={<Status busy={pending} message={error ? errorText(error) : pending ? '正在读取作品' : hiddenActor ? '演员作品已按屏蔽规则隐藏' : '暂无可显示的作品'}
        retry={error ? retry : undefined} />}
      ListFooterComponent={error && items.length > 0 ? <Status message={errorText(error)} retry={retry} /> : null}
      renderItem={({ item }) => <MovieTile movie={item} list onPress={() => {
        position.remember();
        navigation.dispatch(StackActions.push('Work', movieRef(item)));
      }} />} />
  </Page>;
}
