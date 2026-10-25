import { avatarRuntime } from '../vendor/avatarRuntime';
import { AgentConfig, normalizeAgent } from '../data/agent';
import { IconState } from '../data/types';
export interface AvatarPreviewRequest { id: string; config: AgentConfig; action?: string }
export interface AvatarRenderSettings {
  config: AgentConfig; calm: boolean; state: IconState; action?: string;
  interactive: boolean; background: string; dark: boolean; previews?: AvatarPreviewRequest[];
}
export function avatarHtml(settings: AvatarRenderSettings) {
  const json = JSON.stringify({ ...settings, config: normalizeAgent(settings.config) }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';img-src data: blob:;connect-src 'none';base-uri 'none';form-action 'none'"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${settings.background};color-scheme:${settings.dark ? 'dark' : 'light'}}body{display:flex;align-items:center;justify-content:center}agent-robot-avatar,agent-cat-avatar{display:block;width:240px;height:240px}</style></head><body><script>${avatarRuntime.replace(/<\/script/gi, '<\\/script')}\nwindow.curdrApply(${json});</script></body></html>`;
}
