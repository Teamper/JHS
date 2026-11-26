import { ScrollView, StyleSheet, View } from 'react-native';
import type { Movie } from '../../data/models/movie.ts';
import { Body } from './Body.tsx';
import { MovieCard } from './MovieCard.tsx';

export function MovieRail({ title, items, onPress }: { title: string; items: Movie[]; onPress: (movie: Movie) => void }) {
  if (!items.length) return null;
  return <View style={styles.rail}>
    <Body bold size={18}>{title}</Body>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.items}>
      {items.map(item => <View key={item.source + ':' + item.id} style={styles.item}>
        <MovieCard movie={item} onPress={() => onPress(item)} />
      </View>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  rail: { gap: 5 },
  items: { gap: 4 },
  item: { width: 124 },
});
