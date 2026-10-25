import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useStore } from '../data/store';
import { useTheme } from '../theme';
import { AgentConfig, normalizeAgent, shapes, accessories } from '../data/agent';
import { avatarLabels } from '../data/avatarOptions';
import { AgentCharacter } from '../components/AgentCharacter';
import { AvatarPreviewRequest } from '../components/avatarHtml';
import { ColorPicker } from '../components/ColorPicker';
import { RangeSlider } from '../components/RangeSlider';
import { Button, Txt, Icon, Toggle } from '../components/ui';
const steps = ['Shape', 'Colors', 'Face', 'Accessories', 'Motion'];
const popular = ['none', 'headphones', 'glasses', 'bow', 'crown', 'flower', 'cap', 'wizard', 'halo'];
const hats = ['crown', 'party', 'halo', 'beanie', 'flower', 'top-hat', 'fedora', 'cowboy', 'cap', 'beret', 'bucket', 'wizard', 'santa', 'chef', 'graduation', 'pirate'];
const glasses = ['glasses', 'sunglasses', 'round-glasses', 'square-glasses', 'cat-eye', 'aviators', 'heart-glasses', 'star-glasses', 'monocle', 'goggles', 'visor', 'eye-patch'];
function preview(config: AgentConfig, action?: string): AvatarPreviewRequest {
  return { id: JSON.stringify([config, action || 'idle']), config, action };
}
export function AgentStudio({ onClose }: { onClose: () => void }) {
  const { state, api, run, notify } = useStore();
  const { c, calm } = useTheme();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(() => ({ ...normalizeAgent(state.settings.agent), name: 'curdr' }));
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [group, setGroup] = useState('Popular'), [page, setPage] = useState(0);
  const [action, setAction] = useState<{ name: string; tick: number }>();
  const [colorTarget,setColorTarget]=useState<'color'|'eyeColor'>('color'),[accessoryColorOpen,setAccessoryColorOpen]=useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const receive = useCallback((id: string, uri: string) => setImages(previous => previous[id] === uri ? previous : { ...previous, [id]: uri }), []);
  function patch(value: Partial<AgentConfig>) { setDraft(previous => ({ ...previous, ...value })); setAction(undefined); }
  const extras = group === 'Popular' ? popular : group === 'Glasses' ? glasses : group === 'Hats' ? hats : accessories.filter(id => id !== 'none' && !hats.includes(id) && !glasses.includes(id));
  const visibleExtras = extras.slice(page * 9, page * 9 + 9);
  const choices = useMemo(() => {
    if (step === 0) return shapes.map(shape => ({ value: shape, label: avatarLabels[shape]!, request: preview({ ...draft, shape, roundness: shape === 'round' ? 100 : shape === 'squircle' ? 35 : 75 }) }));
    if (step === 2) return (['idle', 'success', 'inspect'] as const).map(expression => ({ value: expression, label: { idle: 'Relaxed', success: 'Happy', inspect: 'Curious' }[expression], request: preview({ ...draft, expression }, expression) }));
    if (step === 3) return visibleExtras.map(accessory => ({ value: accessory, label: avatarLabels[accessory]!, request: preview({ ...draft, accessory: accessory as AgentConfig['accessory'] }) }));
    if (step === 4) return (['float', 'bounce', 'calm'] as const).map(motion => ({ value: motion, label: { float: 'Natural', bounce: 'Lively', calm: 'Quiet' }[motion], request: preview({ ...draft, motion }, motion === 'bounce' ? 'success' : motion === 'calm' ? 'sleep' : 'idle') }));
    return [];
  }, [step, draft, group, page]);
  const previews = choices.map(item => item.request);
  async function save() {
    setBusy(true);
    const success = await run(async () => { await api.settings({ agent: normalizeAgent(draft), icon: 'character' }); return true; });
    setBusy(false);
    if (success) { notify('Appearance saved'); onClose(); }
  }
  function cards(columns: number) {
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {choices.map(item => {
        const selected = step === 0 ? draft.shape === item.value : step === 2 ? draft.expression === item.value : step === 3 ? draft.accessory === item.value : draft.motion === item.value;
        return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={item.label + ' · select'} accessibilityState={{ selected }}
          onPress={() => {
            if (step === 0) patch({ shape: item.value as AgentConfig['shape'], roundness: item.value === 'round' ? 100 : item.value === 'squircle' ? 35 : 75 });
            if (step === 2) { patch({ expression: item.value as AgentConfig['expression'] }); setAction({ name: item.value, tick: Date.now() }); }
            if (step === 3) patch({ accessory: item.value as AgentConfig['accessory'] });
            if (step === 4) { patch({ motion: item.value as AgentConfig['motion'] }); setAction({ name: item.request.action!, tick: Date.now() }); }
          }} style={({ pressed }) => ({ width: columns === 2 ? '48%' : '31%', flexGrow: 1, maxWidth: columns === 2 ? '49%' : '33%', minHeight: columns === 2 ? 126 : 112, padding: 8, borderRadius: 22, backgroundColor: selected ? c.accb : c.tile, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .75 : 1 })}>
          {images[item.request.id] ? <Image accessible={false} source={{ uri: images[item.request.id] }} style={{ width: columns === 2 ? 94 : 74, height: columns === 2 ? 94 : 74 }} /> : <View style={{ width: 74, height: 74, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="small" color={c.acc} /></View>}
          <Txt size={13} bold={selected} numberOfLines={1} style={{ textAlign: 'center', color: selected ? c.acc : c.ink }}>{item.label}</Txt>
          {selected && <View style={{ position: 'absolute', right: 9, top: 9 }}><Icon name="done" color={c.acc} size={16} /></View>}
        </Pressable>;
      })}
    </View>;
  }
  return <View style={{ flex: 1 }}>
    <View style={{ alignItems: 'center', paddingBottom: 8 }}>
      <AgentCharacter config={draft} size={height < 730 ? 130 : 164} action={action?.name} previews={previews} onPreview={receive} onPress={() => {}} />
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Customization progress" accessibilityValue={{ min: 1, max: steps.length, now: step + 1 }} style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
      {steps.map((label, index) => <View key={label} style={{ flex: 1, height: 18, justifyContent: 'center' }}><View style={{ height: 4, borderRadius: 2, backgroundColor: index <= step ? c.acc : c.line }} /></View>)}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}><Txt bold size={24} style={{ flex: 1 }}>{steps[step]}</Txt><Txt size={15}>{step + 1} / {steps.length}</Txt></View>
    <ScrollView key={step} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }} style={{ flex: 1 }}>
      <Animated.View entering={calm ? undefined : FadeIn.duration(180)}>
        {step === 0 && <>{cards(3)}{draft.shape === 'fluid' && <Button onPress={() => patch({ shapeSeed: Math.floor(Math.random() * 999999) })} style={{ marginTop: 12 }}>Shuffle shape</Button>}</>}
        {step === 1 && <><View style={{flexDirection:'row',gap:8,marginBottom:18}}>{([['color','Body'],['eyeColor','Eyes']] as const).map(([id,label])=><Button key={id} primary={colorTarget===id} onPress={()=>setColorTarget(id)} style={{flex:1}}>{label}</Button>)}</View><ColorPicker value={draft[colorTarget]} onChange={value=>patch({[colorTarget]:value})}/></>}
        {step === 2 && <>{cards(3)}<View style={{ marginTop: 12 }}><RangeSlider label="Eye size" min={60} max={125} value={draft.eyeSize} onChange={eyeSize => patch({ eyeSize })} suffix=" %" /><RangeSlider label="Eye spacing" min={-12} max={12} value={draft.spacing} onChange={spacing => patch({ spacing })} /><RangeSlider label="Roundness" min={0} max={100} value={draft.roundness} onChange={roundness => patch({ roundness })} /></View></>}
        {step === 3 && <><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 7 }}>{['Popular', 'Glasses', 'Hats', 'Extras'].map(label => <Pressable key={label} onPress={() => { setGroup(label); setPage(0); }} accessibilityRole="tab" accessibilityState={{ selected: group === label }} style={{ minHeight: 42, borderRadius: 21, backgroundColor: group === label ? c.btn : c.tile, paddingHorizontal: 15, justifyContent: 'center' }}><Txt size={14} style={{ color: group === label ? c.btnfg : c.ink }}>{label}</Txt></Pressable>)}</ScrollView>{cards(3)}<Button onPress={()=>setAccessoryColorOpen(value=>!value)} style={{marginTop:14}}>{accessoryColorOpen?'Hide color picker':'Accessory color'}</Button>{accessoryColorOpen&&<View style={{marginTop:14}}><ColorPicker value={draft.accessoryColor} onChange={accessoryColor=>patch({accessoryColor})}/></View>}{extras.length > 9 && <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}><Button disabled={page === 0} onPress={() => setPage(p => p - 1)} style={{ flex: 1 }}>Previous</Button><Button disabled={(page + 1) * 9 >= extras.length} onPress={() => setPage(p => p + 1)} style={{ flex: 1 }}>More</Button></View>}<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}><Txt>Antenna</Txt><Toggle label="Antenna" value={draft.antenna} onChange={antenna => patch({ antenna })} /></View></>}
        {step === 4 && <>{cards(3)}<View style={{ gap: 12, marginTop: 24 }}><Txt size={18} bold>Preview reactions</Txt><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[['inspect', 'Thinking'], ['waiting', 'Working'], ['success', 'Success'], ['warning', 'Needs you']].map(([name, label]) => <Button key={name} onPress={() => setAction({ name: name!, tick: Date.now() })} style={{ flexGrow: 1, width: '46%' }}>{label}</Button>)}</View></View></>}
      </Animated.View>
    </ScrollView>
    <View style={{ flexDirection: 'row', gap: 12, paddingTop: 14, paddingBottom: 4 }}>
      <Button disabled={busy} onPress={() => step ? setStep(s => s - 1) : onClose()} style={{ flex: 1 }}>{step ? 'Back' : 'Cancel'}</Button>
      <Button primary loading={busy} onPress={() => step < steps.length - 1 ? setStep(s => s + 1) : void save()} style={{ flex: 1.4 }}>{step === steps.length - 1 ? 'Save' : 'Next'}</Button>
    </View>
  </View>;
}
