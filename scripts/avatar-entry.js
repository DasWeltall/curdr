import { configureAvatar, exportAvatar } from '../third_party/avatar-studio/agent-robot-avatar.js';
let avatar = null, previousAction = '', pendingFrame = 0, latestSettings, previewSequence = 0, previewSignature = '', previewTimer = 0, pendingPreviewSignature = '';
const thumbnailCache = new Map();
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
function appearance(c) {
  return { body: c.color, eyes: c.eyeColor, accessoryColor: c.accessoryColor, matchEyes: false,
    eyeSize: c.eyeSize, spacing: c.spacing, headRoundness: c.roundness,
    bodyShape: c.shape === 'fluid' ? 'random' : 'classic', shapeSeed: c.shapeSeed, antenna: c.antenna, accessory: c.accessory };
}
function publishThumbnail(id, uri) {
  const result = { type: 'curdr-preview-result', id, uri };
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(result));
  else parent.postMessage(result, '*');
}
async function thumbnails(items) {
  const signature = JSON.stringify(items.map(item => item.id));
  if (signature === previewSignature) return;
  previewSignature = signature;
  const sequence = ++previewSequence;
  for (const item of items) {
    if (sequence !== previewSequence) return;
    if (thumbnailCache.has(item.id)) { publishThumbnail(item.id, thumbnailCache.get(item.id)); continue; }
    const node = document.createElement(item.config.shape === 'cat' ? 'agent-cat-avatar' : 'agent-robot-avatar');
    node.setAttribute('size', '240');
    node.setAttribute('aria-hidden', 'true');
    Object.assign(node.style, { position: 'absolute', left: '0', top: '0', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(node);
    try {
      for (let i = 0; i < 12 && !node.shadowRoot.getElementById('antennaDot'); i++) await frame();
      configureAvatar(node, { appearance: appearance(item.config), behavior: { motion: 'reduce', pointerFollow: false, pressSqueeze: false, antennaDrag: false, autoSleep: 0, loop: false }, action: item.action || 'idle' });
      await frame();
      const blob = await exportAvatar(node, { format: 'png', size: 160 });
      const uri = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      thumbnailCache.set(item.id, uri);
      if (thumbnailCache.size > 180) thumbnailCache.delete(thumbnailCache.keys().next().value);
      if (sequence === previewSequence) publishThumbnail(item.id, uri);
    } catch { publishThumbnail(item.id, ''); }
    finally { node.remove(); }
  }
}
window.curdrApply = function(settings) {
  latestSettings = settings;
  const { config: c, calm = false, state = 'idle', action, interactive = true, background = 'transparent', dark = false } = settings;
  document.documentElement.style.backgroundColor = background;
  document.body.style.backgroundColor = background;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const tag = c.shape === 'cat' ? 'agent-cat-avatar' : 'agent-robot-avatar';
  if (!avatar || avatar.localName !== tag) {
    avatar?.remove(); avatar = document.createElement(tag); avatar.setAttribute('size', '240'); document.body.appendChild(avatar); previousAction = '';
  }
  if (!avatar.shadowRoot.getElementById('antennaDot')) {
    cancelAnimationFrame(pendingFrame); pendingFrame = requestAnimationFrame(() => window.curdrApply(latestSettings)); return;
  }
  const moodActions = { think: 'inspect', work: 'waiting', need: 'warning', success: 'success', error: 'error', sleep: 'sleep', listen: 'input' };
  const next = action || moodActions[state] || c.expression || 'idle';
  configureAvatar(avatar, { appearance: appearance(c), behavior: { motion: calm || c.motion === 'calm' ? 'reduce' : 'auto',
    pointerFollow: interactive, pressSqueeze: interactive, antennaDrag: interactive,
    loop: !calm && (state === 'work' || state === 'think' || state === 'listen' || c.motion === 'bounce'), autoSleep: 0, antennaFlash: state === 'work' },
    ...(action || next !== previousAction ? { action: next } : {}) });
  previousAction = next;
  const side = Math.min(innerWidth, innerHeight);
  avatar.style.transform = `scale(${side / 240})`; avatar.style.transformOrigin = 'center'; avatar.style.flex = '0 0 240px';
  const pendingSignature = JSON.stringify((settings.previews || []).map(item => item.id));
  if (pendingSignature !== pendingPreviewSignature) {
    pendingPreviewSignature = pendingSignature; previewSequence++; clearTimeout(previewTimer);
    previewTimer = setTimeout(() => void thumbnails(latestSettings.previews || []), 120);
  }
};
window.addEventListener('message', e => {
  if (e.source !== parent && e.source !== window) return;
  if (e.data?.type === 'curdr-avatar') window.curdrApply(e.data.settings);
});
