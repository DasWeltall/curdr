import React, { useMemo, useRef, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { View } from 'react-native';
import { avatarHtml, AvatarRenderSettings } from './avatarHtml';
export interface AvatarSurfaceProps { size: number; settings: AvatarRenderSettings; onPreview?: (id: string, uri: string) => void }
export function AvatarSurface({ size, settings, onPreview }: AvatarSurfaceProps) {
  const ref = useRef<WebView<object>>(null);
  const html = useMemo(() => avatarHtml(settings), []);
  function update() { ref.current?.injectJavaScript(`window.curdrApply&&window.curdrApply(${JSON.stringify(settings).replace(/</g, '\\u003c')});true;`); }
  useEffect(update, [settings]);
  return <View style={{ width: size, height: size, backgroundColor: 'transparent' }} pointerEvents={settings.interactive ? 'auto' : 'none'}>
    <WebView<object> ref={ref} originWhitelist={['about:blank']} source={{ html }} onLoadEnd={update}
      onMessage={event => { try { const value = JSON.parse(event.nativeEvent.data); if (value.type === 'curdr-preview-result' && typeof value.id === 'string' && typeof value.uri === 'string' && /^data:image\/png;base64,/.test(value.uri)) onPreview?.(value.id, value.uri); } catch {} }}
      onShouldStartLoadWithRequest={r => r.url === 'about:blank'} javaScriptEnabled scrollEnabled={false} bounces={false}
      mixedContentMode="never" allowFileAccess={false} setSupportMultipleWindows={false}
      containerStyle={{ backgroundColor: 'transparent' }} style={{ width: size, height: size, backgroundColor: 'transparent' }} />
  </View>;
}
