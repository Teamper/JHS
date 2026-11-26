import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppBottomSheet } from './AppBottomSheet';
import { Body } from './Body.tsx';
import { Button } from './Button.tsx';
import { styles } from './ui.tsx';

export function FilterSheet({ title, close, apply, children }: {
  title: string; close: () => void; apply: () => void; children: ReactNode;
}) {
  return <AppBottomSheet open title={title} close={close}>
    <Body bold size={18}>{title}</Body>
    {children}
    <View style={[styles.row, { justifyContent: 'flex-end' }]}>
      <Button variant="ghost" onPress={close}>取消</Button>
      <Button primary onPress={apply}>应用</Button>
    </View>
  </AppBottomSheet>;
}
