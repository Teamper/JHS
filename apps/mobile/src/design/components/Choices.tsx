import { AppBottomSheet } from './AppBottomSheet';
import { Body } from './Body.tsx';
import { Button } from './Button.tsx';

export type Menu = { title: string; actions: { label: string; run: () => void }[] };

export function Choices({ menu, close }: { menu: Menu | null; close: () => void }) {
  if (!menu) return null;
  return <AppBottomSheet open title={menu.title} close={close}>
    <Body bold size={18}>{menu.title}</Body>
    {menu.actions.map(action => <Button key={action.label} onPress={() => { close(); action.run(); }}>{action.label}</Button>)}
    <Button variant="ghost" onPress={close}>取消</Button>
  </AppBottomSheet>;
}
