import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { siteNames, sites } from '../../data/connections/AccountSessions.ts';
import type { SessionSite } from '../../platform/session/types.ts';
import { useApp } from '../../data/workspace/context.ts';
import { AppBottomSheet } from '../../design/components/AppBottomSheet';
import { Body, Button, GroupedList, Page, Status, errorText, styles } from '../../design/components/ui.tsx';
import { useAccount, useScreenSignal } from './useSession.ts';

function AccountRow({ site, logout }: { site: SessionSite; logout: () => void }) {
  const { connections: { accounts }, feedback } = useApp();
  const state = useAccount(site);
  const signal = useScreenSignal();
  const [checking, setChecking] = useState(false);

  async function check() {
    const current = signal();
    setChecking(true);
    try {
      const account = await accounts.check(site, current);
      if (!current?.aborted) feedback(account ? '账号连接正常' : '请先登录');
    } catch (error) { if (!current?.aborted) feedback(errorText(error)); }
    finally { if (!current?.aborted) setChecking(false); }
  }

  return <View style={{ padding: 14, gap: 6 }}>
    <Body bold>{siteNames[site]}</Body>
    <Body muted size={13}>{state.error || (state.busy ? '正在更新会话' : state.account?.label || (state.checked ? '未连接' : '等待核对'))}</Body>
    <View style={styles.row}>
      <Button disabled={state.busy || checking} onPress={() => void accounts.login(site)
        .then(account => feedback(account ? '账号连接成功' : '请在网页登录后完成确认'), error => feedback(errorText(error)))}>
        {state.account ? '重新登录' : '登录'}
      </Button>
      <Button variant="ghost" disabled={state.busy || checking} onPress={() => void check()}>检测连接</Button>
      {state.checked && <Button variant="ghost" disabled={state.busy || checking} onPress={logout}>退出并清除</Button>}
    </View>
  </View>;
}

export function Accounts() {
  const { workspace, connections: { accounts }, feedback } = useApp();
  const [clear, setClear] = useState<SessionSite | null>(null);
  useFocusEffect(useCallback(() => {
    if (!accounts.available) return;
    const controller = new AbortController();
    void Promise.allSettled(sites.filter(site => !accounts.get(site).busy).map(site => accounts.check(site, controller.signal)));
    return () => controller.abort();
  }, [accounts]));
  return <Page title="账号连接" back>
    {accounts.available ? <ScrollView contentContainerStyle={styles.content}>
      <GroupedList>{sites.map(site => <AccountRow key={site} site={site} logout={() => setClear(site)} />)}</GroupedList>
    </ScrollView> : <Status message={workspace.sample ? '当前使用内置样片，真实账号连接请在在线版中使用。' : '当前系统缺少独立会话支持，请更新系统 WebView 或应用。'} />}
    {clear && <AppBottomSheet open title="退出并清除账号？" close={() => setClear(null)}>
      <Body bold>{'退出 ' + siteNames[clear] + '？'}</Body>
      <Body muted>将清除本机的登录会话和对应授权。</Body>
      <View style={styles.row}>
        <Button variant="ghost" onPress={() => setClear(null)}>取消</Button>
        <Button variant="danger" onPress={() => {
          const site = clear;
          setClear(null);
          void accounts.clear(site).then(() => feedback('账号已退出'), error => feedback(errorText(error)));
        }}>退出并清除</Button>
      </View>
    </AppBottomSheet>}
  </Page>;
}
