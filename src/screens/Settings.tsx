import React, { useEffect, useState } from 'react';
import { View, Pressable, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme';
import {FounderInterview} from './FounderInterview';
import { MessageColors } from './MessageColors';
import { HermesSettings } from './HermesSettings';
import { HttpTransport } from '../data/http';
import { useStore } from '../data/store';
import { Settings as SettingsType } from '../data/types';
import { Txt, Icon, Button, Input, Segments, Toggle } from '../components/ui';
import { AgentCharacter } from '../components/AgentCharacter';
import { ConnectHermes } from './ConnectHermes';
import {NotificationSettings} from './NotificationSettings';
import { InstallApp } from '../components/InstallApp';
import { saveText } from '../files';
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={{ marginTop: 28, gap: 12 }}><Txt bold size={19}>{title}</Txt><View style={{ backgroundColor: c.card, borderRadius: 22, paddingHorizontal: 16 }}>{children}</View></View>;
}
function Row({ title, children, vertical = false }: { title: string; children: React.ReactNode; vertical?: boolean }) {
  return <View style={{ paddingVertical: 15, flexDirection: vertical ? 'column' : 'row', alignItems: vertical ? 'stretch' : 'center', gap: 12 }}><Txt style={{ flex: vertical ? undefined : 1 }}>{title}</Txt>{children}</View>;
}
export function Settings({ onAgent, onDemo }: { onAgent: () => void; onDemo: () => void }) {
  const { c } = useTheme();
  const { state, api, run, notify, disconnect, gatewayUrl, status, setDemo } = useStore();
  const s = state.settings;
  const [interview,setInterview]=useState(false);
  const [timezone,setTimezone]=useState(s.timezone||'Europe/Berlin');
  const [colorsOpen,setColorsOpen]=useState(false),[hermesOpen,setHermesOpen]=useState(false);
  const [connectionOpen,setConnectionOpen]=useState(false),[existing,setExisting]=useState<boolean|null>(null);
  useEffect(()=>{let alive=true;if(api.mode==='gateway')void (api as HttpTransport).request('/health').then(health=>{if(alive)setExisting(health.connection_type==='existing');}).catch(()=>{});return()=>{alive=false;};},[api]);
  const patch = (value: Partial<SettingsType>) => void run(() => api.settings(value));
  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { notify('Photo access was not granted.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .7, base64: true });
    if (!result.canceled && result.assets[0]) {
      const image = result.assets[0];
      if (image.base64 && image.base64.length < 1500000) patch({ pic: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}` });
      else notify('Choose a smaller profile photo.');
    }
  }
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" onPress={() => void pick()} style={{ width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center' }}>
        {s.pic ? <Image source={{ uri: s.pic }} style={{ width: 64, height: 64 }} /> : <Icon name="person" size={30} color={c.ink} />}
      </Pressable>
      <Input accessibilityLabel="Your name" placeholder="Your name" value={s.name} onChangeText={name => patch({ name })} style={{ flex: 1 }} />
    </View>
    <Group title="Profile"><Row title="Founder profile" vertical><Button onPress={()=>setInterview(true)}>Goals & boundaries</Button></Row></Group>
    {interview&&<FounderInterview onClose={()=>setInterview(false)}/>}
    <Group title="Customizing">
      <Pressable accessibilityRole="button" accessibilityLabel="Customizing" onPress={onAgent} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
        <AgentCharacter config={s.agent} size={70} background={c.card} /><Txt bold style={{ flex: 1 }}>Customizing</Txt><Icon name="chev" size={18} />
      </Pressable>
    </Group>
    <Group title="Appearance">
      <Row title="Theme" vertical><Segments value={s.theme} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={theme => patch({ theme })} /></Row>
      <Row title="Message colors"><Button onPress={()=>setColorsOpen(true)}>Customize</Button></Row>
      <Row title="Reduce motion"><Toggle value={s.calm} label="Reduce motion" onChange={calm => patch({ calm })} /></Row>
    </Group>
    {colorsOpen&&<MessageColors onClose={()=>setColorsOpen(false)}/>}
    {hermesOpen&&<HermesSettings onClose={()=>setHermesOpen(false)}/>}
    <Group title="Assistant">
      <Row title="Reply language" vertical><Segments value={s.replyLanguage||"auto"} options={[["auto","Automatic"],["en","English"],["de","German"]]} onChange={replyLanguage=>patch({replyLanguage})}/></Row>
      <Row title="Sleep mode"><Toggle label="Sleep mode" value={!!s.sleeping} onChange={sleeping => patch({ sleeping })}/></Row>
      
    </Group>
    <Group title="Demo">
      <Row title="Demo mode"><Toggle label="Demo mode" value={api.mode==='demo'} onChange={enabled=>void run(async()=>{await setDemo(enabled);if(enabled)onDemo();})}/></Row>
      {api.mode==='demo'&&<View style={{paddingBottom:16,gap:10}}><Button onPress={()=>{api.demoControl?.('restart');onDemo();}}>Replay walkthrough</Button><Button onPress={()=>api.demoControl?.('pause')}>Pause walkthrough</Button><Txt size={13}>A staged preview. No external actions or model charges.</Txt></View>}
    </Group>
    <Group title="Notifications"><NotificationSettings/></Group>
    <Group title="Connection">
      <Row title={api.mode === 'gateway' ? status : 'Hermes'} vertical>
        {api.mode==='gateway'&&<Txt size={14} selectable>{gatewayUrl}</Txt>}
        <Button primary onPress={()=>setConnectionOpen(true)}>{api.mode==='gateway'?'Connect another gateway':'Connect Hermes'}</Button>
        {api.mode==='gateway'&&<Button onPress={()=>void run(disconnect)}>Disconnect</Button>}
      </Row>
    </Group>
    {connectionOpen&&<ConnectHermes onClose={()=>setConnectionOpen(false)}/>}
    {api.mode === 'gateway' && <Group title="Runtime">
      {existing===true?<Row title="Hermes settings" vertical><Button onPress={()=>setHermesOpen(true)}>Models & tools</Button></Row>:existing===false?<><Row title="Model" vertical><Input accessibilityLabel="Model-ID" value={s.model} onChangeText={model => patch({ model })} /></Row>
      <Row title="Monthly budget · USD" vertical><Input accessibilityLabel="Monthly budget" keyboardType="decimal-pad" value={String(s.budget)} onChangeText={v => { const value = Number(v.replace(',', '.')); if (Number.isFinite(value) && value >= 0) patch({ budget: value }); }} /></Row>
      </>:null}
      <Row title="Hermes active"><Toggle label="Hermes active" value={s.sbx} onChange={sbx => patch({ sbx })} /></Row>
    </Group>}
    {Platform.OS==='web'&&<Group title="App"><InstallApp/></Group>}
    <View style={{ marginTop: 28, gap: 12 }}><Button onPress={()=>void run(async()=>{await api.settings({onboarded:false});onDemo();})}>Run onboarding</Button><Button onPress={() => void run(() => saveText('curdr-export.json', JSON.stringify(state, null, 2), 'application/json'))}>Export data</Button></View>
  </>;
}
