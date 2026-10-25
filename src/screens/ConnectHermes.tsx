import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useStore } from '../data/store';
import { gatewayAddress } from '../data/gateway';
import { HttpTransport } from '../data/http';
import { Settings } from '../data/types';
import { useTheme } from '../theme';
import { Sheet } from '../components/Sheet';
import { AgentCharacter } from '../components/AgentCharacter';
import { Button, Icon, Input, Txt } from '../components/ui';
export function ConnectHermes({ onClose, onConnected }: { onClose: () => void; onConnected?: () => void }) {
  const { state, connect, gatewayUrl } = useStore(); const { c } = useTheme();
  const [step, setStep] = useState(0), [url, setUrl] = useState(gatewayUrl), [secret, setSecret] = useState(''), [token, setToken] = useState('');
  const [advanced, setAdvanced] = useState(false), [help, setHelp] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [remote, setRemote] = useState<Settings | null>(null), [profile, setProfile] = useState<'local' | 'remote'>('local'), [voiceReady, setVoiceReady] = useState(false);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect.'); } finally { setBusy(false); } }
  async function find() {
    const address = gatewayAddress(url, Platform.OS !== 'web');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(address + '/health', { signal: controller.signal });
      if (response.status !== 401) {
        const body = await response.json();
        if (body.agent !== 'hermes') { setHelp(true); throw Error('This looks like the Hermes API. Add the curdr gateway beside it to save your workspace and enable voice.'); }
      }
      setUrl(address); setStep(1);
    } catch (e) {
      if (e instanceof TypeError || e instanceof Error && e.name === 'AbortError') throw Error(Platform.OS === 'web' ? 'Server unreachable. Check its address, HTTPS certificate and allowed browser origin. Local HTTP connections work in the Android app.' : 'Server unreachable. Use the gateway’s LAN IP, stay on the same Wi-Fi and allow its port through the host firewall.');
      throw e;
    } finally { clearTimeout(timer); }
  }
  async function authenticate() {
    let access = secret.trim();
    if (!advanced) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url + '/pair/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: access }), signal: controller.signal });
        const result = await response.json();
        if (!response.ok || typeof result.token !== 'string') throw Error(typeof result.detail === 'string' ? result.detail : 'Pairing failed. Generate a fresh code on the gateway.');
        access = result.token;
        // Keep an exchanged credential in memory so a health retry never consumes the code twice.
        setSecret(access); setAdvanced(true);
      } finally { clearTimeout(timer); }
    }
    const server = new HttpTransport(url, access), health = await server.request('/health');
    if (health.agent !== 'hermes') { setHelp(true); throw Error('Connect to the curdr gateway, not the Hermes API port.'); }
    if (health.agent_status !== 'ready') throw Error('The gateway is reachable, but Hermes is not ready. Check its API key, provider and gateway process on the host, then retry.');
    const saved: Settings = await server.request('/settings');
    setRemote(saved); setProfile(saved.onboarded && saved.name ? 'remote' : 'local'); setToken(access); setVoiceReady(health.capabilities?.audio === true); setSecret(''); setStep(2);
  }
  async function finish() { await connect(url, token, undefined, profile); onConnected?.(); onClose(); }
  return <Sheet title="Connect Hermes" onClose={onClose}>
    <View style={{ gap: 22 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>{[0, 1, 2].map(value => <View key={value} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: value <= step ? c.ink : c.tile }} />)}</View>
      <Txt size={31} bold>{['Find your gateway.', 'Make it yours.', 'Bring your profile.'][step]}</Txt>
      {step === 0 ? <>
        <Txt>Keep your Hermes. The curdr gateway connects this app to it and saves your conversations, tasks and settings.</Txt>
        <Input accessibilityLabel="Gateway address" placeholder="http://192.168.1.50:8000" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={value=>{setUrl(value);setSecret('');setToken('');setRemote(null);}} onSubmitEditing={() => void run(find)} />
        <Txt size={14}>{Platform.OS === 'web' ? 'The website needs an HTTPS gateway. For a local HTTP address, use the Android app on the same Wi-Fi.' : 'Use the host’s LAN address. Your phone and Hermes host must be on the same Wi-Fi.'}</Txt>
        <Button primary loading={busy} disabled={!url.trim()} onPress={() => void run(find)}>Find gateway</Button>
        <Pressable accessibilityRole="button" onPress={() => setHelp(value => !value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="plus" size={17} /><Txt size={15}>{help ? 'Hide setup' : 'Set up the gateway'}</Txt></Pressable>
      </> : step === 1 ? <>
        <View style={{ padding: 18, borderRadius: 22, backgroundColor: c.tile, gap: 7 }}><Txt bold>On your Hermes host</Txt><Txt selectable size={14}>curdr-gateway pair</Txt><Txt size={14}>Copy the single-use code shown in that terminal. It expires in 10 minutes.</Txt></View>
        <Input accessibilityLabel={advanced ? 'Access token' : 'Pairing code'} placeholder={advanced ? 'Gateway access token' : 'Pairing code'} secureTextEntry autoCapitalize="none" autoCorrect={false} value={secret} onChangeText={setSecret} />
        <Button primary loading={busy} disabled={!secret.trim()} onPress={() => void run(authenticate)}>Verify connection</Button>
        <Pressable accessibilityRole="button" onPress={() => { setAdvanced(value => !value); setSecret(''); }} style={{ minHeight: 44, justifyContent: 'center' }}><Txt size={14}>{advanced ? 'Use a pairing code' : 'Use an access token instead'}</Txt></Pressable>
      </> : <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="done" size={20} color={c.ok} /><Txt>Hermes is ready.</Txt></View>
        <Txt>Choose the name, photo, appearance and preferences to use. Saved conversations and tasks stay on the gateway.</Txt>
        {(['local', 'remote'] as const).filter(value => value === 'local' || remote?.onboarded).map(value => { const settings = value === 'local' ? state.settings : remote!; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: profile === value }} onPress={() => setProfile(value)} style={{ padding: 16, borderRadius: 24, backgroundColor: profile === value ? c.ai : c.tile, flexDirection: 'row', alignItems: 'center', gap: 12 }}><AgentCharacter config={settings.agent} size={58} animate={false} /><View style={{ flex: 1, gap: 3 }}><Txt bold>{value === 'local' ? 'This device' : 'Saved on gateway'}</Txt><Txt size={14}>{settings.name || 'Your profile'}</Txt></View>{profile === value && <Icon name="done" size={19} />}</Pressable>; })}
        <Txt size={14}>{profile === 'local' ? 'These personal preferences will be copied to the gateway for your other devices.' : 'Your saved gateway profile will be loaded on this device.'}</Txt>
        {!voiceReady && <View style={{ padding: 16, gap: 6, borderRadius: 20, backgroundColor: c.tile }}><Txt bold>Enable voice on the host</Txt><Txt selectable size={14}>curdr-gateway voice-setup</Txt><Txt size={14}>Chat works now. Voice transcription also needs ffmpeg and the voice package on the gateway.</Txt></View>}
        <Txt size={14}>Your existing Hermes tools and approval rules apply to requests sent from curdr.</Txt>
        <Button primary loading={busy} onPress={() => void run(finish)}>Connect & start</Button>
      </>}
      {help && <View style={{ padding: 18, borderRadius: 24, gap: 14, backgroundColor: c.tile }}>
        <Txt bold>1. Enable the existing Hermes API</Txt><Txt size={14}>On that host, add to ~/.hermes/.env and restart its gateway. Choose a long random API key.</Txt>
        <Txt selectable size={13} style={{ fontFamily: 'monospace' }}>{'API_SERVER_ENABLED=true\nAPI_SERVER_KEY=<your-random-key>\n\nhermes gateway'}</Txt>
        <Txt bold>2. Install curdr beside Hermes</Txt><Txt size={14}>From the curdr source folder, use a separate Python environment. Keep the existing Hermes API on 127.0.0.1:8642.</Txt>
        <Txt selectable size={13} style={{ fontFamily: 'monospace' }}>{'python3 -m venv .venv-curdr\n. .venv-curdr/bin/activate\npip install "./backend[voice]"\ncurdr-gateway configure --host YOUR_LAN_IP\ncurdr-gateway voice-setup\ncurdr-gateway serve'}</Txt>
        <Txt size={14}>Install ffmpeg first. Configure asks for the Hermes API key privately. Allow port 8000 only on your LAN. Then enter the address and pairing code printed by serve.</Txt>
      </View>}
      {!!error && <View accessibilityRole="alert" style={{ padding: 16, backgroundColor: c.tile, borderRadius: 20 }}><Txt style={{ color: c.amb }}>{error}</Txt></View>}
      {step > 0 && <Button disabled={busy} onPress={() => { setStep(value => value - 1); setError(''); }}>Back</Button>}
    </View>
  </Sheet>;
}
