import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useAppearance, usePrivacy } from '../appearance.ts';
import { Icon } from './Icon.tsx';

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const { palette } = useAppearance();
  const { masked } = usePrivacy();
  return <View style={[styles.search, { backgroundColor: palette.surfaceRecessed }]}>
    <Icon name="search" size={19} color={palette.textTertiary} />
    <TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor={palette.textTertiary} autoCapitalize="none" autoCorrect={false} secureTextEntry={masked}
      returnKeyType="search" style={[styles.input, { color: palette.textPrimary }]} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" onPress={() => onChange('')} style={styles.clear}>
      <Icon name="x" size={17} color={palette.textSecondary} />
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  search: { minHeight: 52, borderRadius: 26, paddingLeft: 16, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 16 },
  clear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
