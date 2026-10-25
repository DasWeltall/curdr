import React,{useState} from 'react';
import {View,ScrollView,Pressable} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useStore} from '../data/store';
import {useTheme} from '../theme';
import {AgentCharacter} from '../components/AgentCharacter';
import {Button,Txt,Input,Segments,Toggle} from '../components/ui';
import {Sheet} from '../components/Sheet';
import {Toast} from '../components/Toast';
import {ConnectHermes} from './ConnectHermes';
import {AgentStudio} from './AgentStudio';
export function Onboarding(){
  const {state,api,run,setDemo,error,dismiss}=useStore();const {c}=useTheme();const insets=useSafeAreaInsets();
  const [step,setStep]=useState(0),[name,setName]=useState(''),[customizing,setCustomizing]=useState(false),[busy,setBusy]=useState(false);
  const [connectNow,setConnectNow]=useState(false);
  async function next(){if(step===0){setBusy(true);const saved=await run(async()=>{await api.settings({name:name.trim(),fs:1,ton:'kurz',pro:'aktiv'});return true;});setBusy(false);if(!saved)return;}setStep(value=>value+1);}
  async function finish(demo=false){setBusy(true);await run(async()=>{const settings={...state.settings,name:name.trim(),fs:1,ton:'kurz' as const,pro:'aktiv' as const,onboarded:true};await api.settings(settings);if(demo)await setDemo(true,settings);});setBusy(false);}
  const titles=['What should we call you?',`Welcome, ${name.trim()||'you'}.`,'Meet your assistant.'];
  return <View style={{position:'absolute',inset:0,zIndex:80,backgroundColor:c.bg,paddingTop:insets.top+24,paddingBottom:insets.bottom+20}}><View style={{flex:1,paddingHorizontal:26,maxWidth:460,width:'100%',alignSelf:'center'}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:30}}><Txt bold size={23}>curdr</Txt><Txt size={13} muted>{step+1} / 3</Txt></View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{flexGrow:1,gap:24,paddingBottom:30}}>
      <View style={{alignItems:'center',paddingTop:12,paddingBottom:8}}><AgentCharacter config={state.settings.agent} size={154}/></View>
      <Txt size={34} bold>{titles[step]}</Txt>
      {step===0?<Input accessibilityLabel="Your name" autoComplete="given-name" autoCapitalize="words" placeholder="Your name" value={name} onChangeText={setName} maxLength={60} returnKeyType="next" onSubmitEditing={()=>{if(name.trim())void next();}} style={{fontSize:22,minHeight:64}}/>:step===1?<>
        <Button onPress={()=>setCustomizing(true)}>Customizing</Button>
        <Segments value={state.settings.theme} options={[["system","System"],["light","Light"],["dark","Dark"]]} onChange={theme=>void run(()=>api.settings({theme}))}/>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:12}}><Txt>Quiet hours</Txt><Toggle label="Quiet hours" value={state.settings.quiet} onChange={quiet=>void run(()=>api.settings({quiet}))}/></View>
      </>:<><Txt>Bring your conversations, tasks and creations together with Hermes.</Txt>
        <Button onPress={()=>setConnectNow(true)}>Connect Hermes</Button>
        <Pressable accessibilityRole="button" onPress={()=>void finish(true)} style={{minHeight:44,justifyContent:'center',alignItems:'center'}}><Txt size={15}>Try the demo first</Txt></Pressable>
      </>}
    </ScrollView>
    <View style={{flexDirection:'row',gap:12,paddingTop:14}}>{step>0&&<Button disabled={busy} onPress={()=>setStep(value=>value-1)} style={{flex:1}}>Back</Button>}<Button primary style={{flex:1.5}} loading={busy} disabled={step===0&&!name.trim()} onPress={()=>step<2?void next():void finish()}>{step<2?'Continue':'Get started'}</Button></View>
    </View>{connectNow&&<ConnectHermes onClose={()=>setConnectNow(false)}/>} {customizing&&<Sheet title="Customizing" scroll={false} onClose={()=>setCustomizing(false)}><AgentStudio onClose={()=>setCustomizing(false)}/></Sheet>}{error&&<Toast message={error} error onClose={dismiss} top={insets.top+65}/>}</View>;
}
