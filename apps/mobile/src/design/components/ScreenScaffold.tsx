import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppearance, usePrivacy } from '../appearance.ts';
import { GlassBackdrop, GlassSurface } from '../glass/GlassSurface';
import { ScreenBackdrop, useRegisterBackdrop } from '../glass/backdropContext.tsx';
import { screenGutter, tabBar } from '../tokens/metrics.ts';
import { typography } from '../tokens/typography.ts';
import { Body } from './Body.tsx';
import { GlassPillButton } from './GlassPillButton.tsx';

export function useTabContentInset() {
  const insets = useSafeAreaInsets();
  return insets.bottom + tabBar.height + tabBar.gap + tabBar.inset;
}

export function ScreenScaffold({ children, title, subtitle, back = false, action, showHeader = true, overlayHeader = false }: {
  children: ReactNode; title: string; subtitle?: string; back?: boolean; action?: ReactNode; showHeader?: boolean; overlayHeader?: boolean;
}) {
  const navigation = useNavigation();
  const { palette, reduceTransparency } = useAppearance();
  const { masked, togglePrivacy } = usePrivacy();
  const target = useRef<View>(null);
  const capture = useRef<View>(null);
  const [headerHeight, setHeaderHeight] = useState(subtitle ? 87 : 70);
  useRegisterBackdrop(target, capture);
  return <ScreenBackdrop.Provider value={target}>
    <SafeAreaView edges={back ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']} style={[styles.fill, { backgroundColor: palette.canvas }]}>
      <View style={styles.fill}>
        <GlassBackdrop target={target} capture={capture} style={[styles.fill, { backgroundColor: palette.canvas, paddingTop: showHeader && !overlayHeader ? headerHeight : 0 }]}>
          {children}
        </GlassBackdrop>
        {showHeader && <View pointerEvents="box-none" style={styles.header} onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
          {overlayHeader && <LinearGradient pointerEvents="none" colors={[palette.canvas, palette.canvas, palette.canvas + '00']}
            locations={[0, 0.6, 1]} style={styles.headerEdge} />}
          {overlayHeader && <View pointerEvents="none" style={styles.headerBackdrop}>
            <GlassSurface radius={27} reduceTransparency={reduceTransparency} style={StyleSheet.absoluteFill} />
          </View>}
          {back && <GlassPillButton label="返回" icon="arrow-left" onPress={() => navigation.goBack()} />}
          <View pointerEvents="none" style={styles.fill}><Body bold style={back ? typography.section : typography.title}>{title}</Body>
            {subtitle && <Body size={13} muted tabular>{subtitle}</Body>}
          </View>
          {action ?? <GlassPillButton label={masked ? '关闭隐私遮罩' : '打开隐私遮罩'} icon={masked ? 'eye-off' : 'eye'} onPress={togglePrivacy} />}
        </View>}
      </View>
    </SafeAreaView>
  </ScreenBackdrop.Provider>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: screenGutter,
    paddingTop: 12, paddingBottom: 14, gap: 12, alignItems: 'center' },
  headerBackdrop: { position: 'absolute', left: 10, right: 10, top: 6, bottom: 8 },
  headerEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 17 },
});
