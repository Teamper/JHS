import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { LifecycleScope, parseBooleanSetting } from '@jhs/core';
import { useApp } from '../workspace/context.ts';
import { usePrivacy } from '../../design/appearance.ts';
import { useSettingsValue } from './useThemeSetting.ts';

export const translateTitles = (settings: Readonly<Record<string, unknown>>) => parseBooleanSetting(settings.androidTranslateTitle, true);

export function useTranslatedTitle(title: string) {
  const { workspace, translation } = useApp();
  const { masked } = usePrivacy();
  const focused = useIsFocused();
  const setting = useSettingsValue(workspace, translateTitles);
  const active = setting && focused && !workspace.sample && !masked && !!title.trim();
  const [translated, setTranslated] = useState<{ original: string; text: string }>();
  useEffect(() => {
    if (!active) return;
    const scope = new LifecycleScope('mobile-title-translation');
    void translation.translate(title, { sourceLanguage: 'auto', targetLanguage: 'zh-CN', scope,
      canDispatch: () => !scope.disposed && translateTitles(workspace.settings.snapshot()) }).then(text => {
      if (!scope.disposed) setTranslated({ original: title, text });
    }, () => { /* Leave the original title visible if translation fails. */ });
    return () => scope.dispose();
  }, [active, title, translation, workspace]);
  return setting && translated?.original === title ? translated.text : title;
}
