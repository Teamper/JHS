import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { chooseBackup, saveBackup } from '../../platform/device/backupIO.ts';
import { Body, Button, Page, Status, errorText, styles } from '../../design/components/ui.tsx';
import { useApp } from '../../data/workspace/context.ts';

export function Backup() {
  const { workspace, feedback } = useApp();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof workspace.previewBackup>> | null>(null);
  const [failure, setFailure] = useState('');
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setFailure(''); setBusy(true);
    try { await action(); }
    catch (error) { setFailure(errorText(error)); }
    finally { setBusy(false); }
  }

  return <Page title="备份与恢复" back><ScrollView contentContainerStyle={styles.content}>
    <Body muted>在手机和桌面之间转移片库、追新和设置。</Body>
    <Button primary icon="upload" disabled={busy || !!pending} onPress={() => void run(async () => {
      const text = await chooseBackup();
      if (text !== null) setPending(await workspace.previewBackup(text));
    })}>选择备份文件</Button>
    <Button icon="download" disabled={busy || !!pending} onPress={() => void run(async () => {
      await saveBackup(await workspace.backup());
    })}>导出备份</Button>
    {pending && <View style={styles.section}>
      <Body bold>{pending.movies == null ? '确认应用备份' : `备份包含 ${pending.movies} 部作品`}</Body>
      <Body muted>将应用备份中的片库与偏好。导入前会保留当前数据的恢复点。</Body>
      <View style={styles.row}><Button disabled={busy} onPress={() => setPending(null)}>取消</Button>
        <Button primary disabled={busy} onPress={() => void run(async () => {
          await workspace.restoreBackup(pending.incoming); setPending(null); feedback('备份已恢复');
        })}>确认导入</Button></View>
    </View>}
    {busy && <Status message="正在处理备份" busy />}
    {failure && <Status message={failure} />}
  </ScrollView></Page>;
}
