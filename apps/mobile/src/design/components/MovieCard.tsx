import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useAppearance, usePrivacy } from '../appearance.ts';
import { flags, type Movie } from '../../data/models/movie.ts';
import { sampleMovies } from '../../data/models/samples.ts';
import { Body } from './Body.tsx';
import { Icon } from './Icon.tsx';
import { useTranslatedTitle } from '../../data/queries/useTranslatedTitle.ts';

export function coverUri(movie: Movie) {
  return movie.coverUrl ?? (movie.source === 'sample' ? sampleMovies.find(sample => sample.carNum === movie.carNum)?.coverUrl : undefined);
}

export function Cover({ movie, hero = false }: { movie: Movie; hero?: boolean }) {
  const { palette, reduceMotion } = useAppearance();
  const { masked } = usePrivacy();
  const uri = coverUri(movie);
  return <View style={[styles.cover, { backgroundColor: palette.surfaceElevated, aspectRatio: hero ? 1.64 : 1.62 }]}>
    {!masked && uri ? <Image source={{ uri }} contentFit={hero ? 'contain' : 'cover'} recyclingKey={movie.id}
      style={StyleSheet.absoluteFill} cachePolicy="memory-disk" transition={reduceMotion || uri.startsWith('data:') ? 0 : 140} accessible={false} /> :
      <Icon name={masked ? 'eye-off' : 'film'} size={26} color={palette.textTertiary} />}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, { borderColor: palette.hairline }]} />
  </View>;
}

export function MovieCard({ movie, onPress, list = false, selected, onLongPress, subtitle }: {
  movie: Movie; onPress: () => void; list?: boolean; selected?: boolean; onLongPress?: () => void; subtitle?: string;
}) {
  const { palette } = useAppearance();
  const { masked } = usePrivacy();
  const displayTitle = useTranslatedTitle(movie.title);
  const title = masked ? '已隐藏的作品' : displayTitle;
  const meta = !masked && [movie.carNum, movie.releaseDate, movie.rating?.toFixed(1)].filter(Boolean).join(' · ');
  const states = Object.entries(movie.stateFlags ?? {}).filter(([, enabled]) => enabled).map(([key]) => flags[key as keyof typeof flags]);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected }}
    onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [list ? styles.list : styles.tile, {
      opacity: pressed ? 0.76 : 1, backgroundColor: selected ? palette.accentSoft : 'transparent',
      borderColor: palette.hairline,
    }]}>
    <View style={list ? styles.thumb : styles.art}><Cover movie={movie} />
      {!list && !masked && states.length > 0 && <View style={[styles.badge, { backgroundColor: palette.glassTint, borderColor: palette.glassRim }]}>
        <Body size={11} numberOfLines={1}>{states[0]}{states.length > 1 ? ` +${states.length - 1}` : ''}</Body>
      </View>}
    </View>
    <View style={list ? styles.copy : undefined}>
      <Body size={15} bold numberOfLines={2}>{title}</Body>
      {!!meta && <Body muted size={12} numberOfLines={1} tabular>{meta}</Body>}
      {!masked && subtitle && <Body muted size={12} numberOfLines={1}>{subtitle}</Body>}
      {list && !masked && !!states.length && <Body muted size={12} numberOfLines={1}>{states.join(' · ')}</Body>}
    </View>
    {selected && <View style={list ? undefined : styles.check}><Icon name="check-circle" size={20} color={palette.accent} /></View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  cover: { width: '100%', borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  rim: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 104 },
  art: { marginBottom: 6 },
  tile: { margin: 5, paddingBottom: 14, borderRadius: 12, gap: 1, flex: 1, minWidth: 0 },
  list: { minHeight: 86, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 12, flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
  badge: { position: 'absolute', bottom: 5, right: 5, paddingHorizontal: 8, paddingVertical: 3,
    maxWidth: '94%', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  check: { position: 'absolute', top: 7, right: 7 },
});
