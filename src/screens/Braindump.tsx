import {request,useResource} from '../data/workspace';
import { KeyboardAvoidingView } from '../components/KeyboardLayout';
import React,{useState} from 'react';
import {View,Modal,ScrollView,Platform,Pressable} from 'react-native';

import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated,{FadeIn,ZoomIn} from 'react-native-reanimated';
import {useStore} from '../data/store';
import {useTheme} from '../theme';
import {Draft} from '../data/types';
import {Avatar} from '../components/Avatar';
import {useVoiceRecorder} from '../hooks/useVoiceRecorder';
import {Waveform} from '../components/Waveform';
import {AudioBubble,audioTime} from '../components/AudioBubble';
import {Button,Txt,Input,Icon,IconButton} from '../components/ui';
import {Toast} from '../components/Toast';
export function Braindump({onClose}:{onClose:()=>void}){
 const {c,calm,isDark}=useTheme();const insets=useSafeAreaInsets();const {api,run,state,error,dismiss}=useStore();const voice=useVoiceRecorder();
 const history=useResource<{id:string;text:string;createdAt:string}[]>('/captures',[]);const [showHistory,setShowHistory]=useState(false);
 const [mode,setMode]=useState<'voice'|'type'|'result'>('voice'),[text,setText]=useState(''),[drafts,setDrafts]=useState<Draft[]>([]),[saved,setSaved]=useState<string[]>([]),[busy,setBusy]=useState(false),[phase,setPhase]=useState('');
 async function collect(){
  if(busy||voice.recording||(!text.trim()&&!voice.draft))return;
  setBusy(true);
  try{
   let captured=text;
   if(voice.draft){setPhase('Transcribing…');const transcript=await run(()=>api.transcribe(voice.draft!));if(!transcript)return;captured=[text,transcript].filter(Boolean).join('\n');setText(captured);voice.clear();}
   if(!captured.trim())return;
   setPhase('Making your plan…');const result=await run(()=>api.braindump(captured));
   if(result?.length){setDrafts(result);setMode('result');}
  }finally{setBusy(false);setPhase('');}
 }
 async function commit(draft:Draft,start:boolean){setBusy(true);const result=await run(()=>draft.kind&&draft.kind!=='task'&&api.mode==='gateway'?request(api,'/captures/drafts/'+draft.id+'/park','POST',{}):api.commitDraft(draft,start));if(result)setSaved(previous=>[...previous,draft.id]);setBusy(false);}
 async function save(){setBusy(true);for(const draft of drafts){if(saved.includes(draft.id))continue;const result=await run(()=>draft.kind&&draft.kind!=='task'&&api.mode==='gateway'?request(api,'/captures/drafts/'+draft.id+'/park','POST',{}):api.commitDraft(draft,false));if(!result){setBusy(false);return;}setSaved(previous=>[...previous,draft.id]);}setBusy(false);onClose();}
 async function close(){if(voice.recording)await run(voice.stop);onClose();}
 return <Modal presentationStyle="fullScreen" animationType="fade" onRequestClose={()=>void close()}><View style={{flex:1,backgroundColor:c.bg}}><KeyboardAvoidingView behavior={Platform.OS==='web'?undefined:'padding'} style={{flex:1,backgroundColor:c.bg}}><Animated.View entering={calm?undefined:ZoomIn.duration(250)} style={{flex:1,maxWidth:460,width:'100%',alignSelf:'center',paddingTop:insets.top+14,paddingBottom:insets.bottom+22,paddingHorizontal:24}}>
 <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><IconButton name="x" label="Close brain dump" onPress={()=>void close()}/><Txt size={16} bold>Brain dump</Txt><View style={{width:44}}/></View>
 <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{flexGrow:1,justifyContent:mode==='result'?'flex-start':'center',paddingTop:20,paddingBottom:20,gap:22}}>
 <View style={{alignItems:'center',gap:20}}><Avatar size={mode==='result'?70:110} state={busy?'think':voice.recording?'listen':'idle'} kind={state.settings.icon}/><Txt bold size={31} style={{textAlign:'center',maxWidth:330}}>{mode==='result'?`${drafts.length} ${drafts.length===1?'thing':'things'},\none clearer plan.`:mode==='voice'?'Tell me everything\non your mind.':'Get it out of your head.'}</Txt></View>
 {mode==='type'?<Input accessibilityLabel="Brain dump" multiline value={text} onChangeText={setText} placeholder="The messy version is welcome…" style={{minHeight:180,lineHeight:25,fontSize:18,backgroundColor:c.card,borderRadius:24}}/>:mode==='voice'?<View style={{alignItems:'center',gap:22,paddingVertical:20}}>{voice.draft?<View style={{width:'100%',padding:18,backgroundColor:c.card,borderRadius:24}}><AudioBubble uri={voice.draft.uri} duration={voice.draft.duration} peaks={voice.draft.peaks}/></View>:<Pressable accessibilityRole="button" accessibilityLabel={voice.recording?'Stop recording':'Start recording'} disabled={busy||voice.busy} onPress={()=>void run(voice.recording?voice.stop:voice.start)} style={{width:90,height:90,borderRadius:45,backgroundColor:voice.recording?c.ambb:c.tile,alignItems:'center',justifyContent:'center'}}><Icon name={voice.recording?'stop':'mic'} size={34}/></Pressable>}<View style={{width:220}}>{voice.recording&&<Waveform peaks={voice.peaks} live/>}</View>{!voice.draft&&<Txt size={15}>{voice.recording?`${audioTime(voice.duration)} · Tap to finish`:'Tap to record. No rush.'}</Txt>}{voice.draft&&<Button disabled={busy} onPress={voice.clear}>Record again</Button>}</View>:<View style={{gap:10}}>{drafts.map((draft,index)=><Animated.View key={draft.id} entering={calm?undefined:FadeIn.delay(index*45)} style={{backgroundColor:c.card,borderRadius:22,padding:16,gap:9}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><View style={{flex:1}}><Input accessibilityLabel={`Task ${index+1} title`} value={draft.title} editable={!saved.includes(draft.id)} onChangeText={title=>setDrafts(previous=>previous.map(item=>item.id===draft.id?{...item,title}:item))} style={{padding:0,minHeight:36,backgroundColor:'transparent',fontSize:17}}/><Input accessibilityLabel={`Task ${index+1} channel`} value={draft.channel} editable={!saved.includes(draft.id)} autoCapitalize="none" onChangeText={channel=>setDrafts(previous=>previous.map(item=>item.id===draft.id?{...item,channel:channel.replace(/^#/,'')}:item))} style={{padding:0,minHeight:28,backgroundColor:'transparent',fontSize:13,color:c.mute}}/></View>{saved.includes(draft.id)?<Txt size={13} style={{color:c.ok}}>{draft.kind&&draft.kind!=='task'?'Parked':'Started'}</Txt>:<Button primary disabled={busy||!draft.title.trim()} onPress={()=>void commit(draft,true)}>{draft.kind&&draft.kind!=='task'?'Park':'Start'}</Button>}</View><Txt size={11} bold muted>{draft.kind==='idea'?'IDEA · VALIDATE OR PARK':draft.kind==='note'?'NOTE · KEEP WITHOUT A TASK':'ACTION · REVIEW BEFORE STARTING'}</Txt>{!!draft.sub&&<Txt size={13} muted>{draft.sub}</Txt>}</Animated.View>)}</View>}
 </ScrollView>
 <View style={{gap:12}}>{mode==='result'?<View style={{flexDirection:'row',gap:10}}><Button disabled={busy} onPress={()=>setMode('type')} style={{flex:1}}>Back</Button><Button primary loading={busy} disabled={drafts.some(d=>!d.title.trim()||!d.channel.trim())} onPress={()=>void save()} style={{flex:1.6}}>{saved.length===drafts.length?'Done':'Save for later'}</Button></View>:<><Button primary loading={busy} disabled={(!text.trim()&&!voice.draft)||voice.recording||voice.busy} onPress={()=>void collect()}>{phase||'Make a plan'}</Button><Button disabled={busy||voice.recording} onPress={()=>setMode(value=>value==='voice'?'type':'voice')}>{mode==='voice'?'Type instead':'Record instead'}</Button></>}</View>
 {mode!=='result'&&!!history.value.length&&<><Button onPress={()=>setShowHistory(!showHistory)}>Previous brain dumps</Button>{showHistory&&<ScrollView style={{maxHeight:150}}>{history.value.map(capture=><Pressable key={capture.id} onPress={()=>{setText(capture.text);setMode('type');setShowHistory(false);}} style={{padding:12}}><Txt numberOfLines={2}>{capture.text}</Txt></Pressable>)}</ScrollView>}</>}
 {error&&<Toast message={error} error onClose={dismiss} top={60}/>}
 </Animated.View></KeyboardAvoidingView></View></Modal>;
}
