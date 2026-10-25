import React, { useEffect, useMemo, useRef } from 'react';
import { avatarHtml, AvatarRenderSettings } from './avatarHtml';
export interface AvatarSurfaceProps { size: number; settings: AvatarRenderSettings; onPreview?: (id: string, uri: string) => void }
export function AvatarSurface({ size, settings, onPreview }: AvatarSurfaceProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => avatarHtml(settings), []);
  const send = () => ref.current?.contentWindow?.postMessage({ type: 'curdr-avatar', settings }, '*');
  useEffect(send, [settings]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || event.data?.type !== 'curdr-preview-result') return;
      if (typeof event.data.id === 'string' && typeof event.data.uri === 'string' && /^data:image\/png;base64,/.test(event.data.uri)) onPreview?.(event.data.id, event.data.uri);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onPreview]);
  return React.createElement('iframe', { ref, srcDoc: html, title: 'curdr', sandbox: 'allow-scripts', onLoad: send,
    tabIndex: settings.interactive ? 0 : -1, style: { width: size, height: size, border: 0, display: 'block', backgroundColor: 'transparent', colorScheme: settings.dark ? 'dark' : 'light', pointerEvents: settings.interactive ? 'auto' : 'none' } });
}
