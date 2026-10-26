import {request,useResource} from '../data/workspace';
import { KeyboardAvoidingView } from '../components/KeyboardLayout';
import React,{useState} from 'react';
import {View,Modal,ScrollView,Platform,Pressable,Keyboard} from 'react-native';

import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated,{FadeIn,ZoomIn} from 'react-native-reanimated';
import {useStore} from '../data/store';
import {useTheme} from '../theme';
import {Draft} from '../data/types';
import {Avatar} from '../components/Avatar';
import {useVoiceRecorder} from '../hooks/useVoiceRecorder';
import {ComposerVoice} from '../components/ComposerVoice';
import {Waveform} from '../components/Waveform';
import {AudioBubble,audioTime} from '../components/AudioBubble';
import {Button,Txt,Input,Icon,IconButton} from '../components/ui';
import {Toast} from '../components/Toast';
export function Braindump({onClose}:{onClose:()=>void}){
 const {c,calm,isDark}=useTheme();const insets=useSafeAreaInsets();const {api,run,state,error,dismiss}=useStore();const voice=useVoiceRecorder();
 const history=useResource<{id:string;text:string;createdAt:string}[]>('/captures',[]);const [showHistory,setShowHistory]=useState(false);const [selected,setSelected]=useState(0),[editing,setEditing]=useState(false);
 const [mode,setMode]=useState<'voice'|'type'|'processing'|'result'>('voice'),[text,setText]=useState(''),[drafts,setDrafts]=useState<Draft[]>([]),[saved,setSaved]=useState<string[]>([]),[busy,setBusy]=useState(false),[phase,setPhase]=useState('');
 async function collect(){
  if(busy||voice.recording||(!text.trim()&&!voice.draft))return;
  Keyboard.dismiss();setMode('processing');setBusy(true);
  try{
   let captured=text;
   if(voice.draft){setPhase('Transcribing…');const transcript=await run(()=>api.transcribe(voice.draft!));if(!transcript){setMode('voice');return;}captured=[text,transcript].filter(Boolean).join('\n');setText(captured);voice.clear();}
   if(!captured.trim()){setMode('type');return;}
   setPhase('Making your plan…');const result=await run(()=>api.braindump(captured));
   if(result?.length){setDrafts(result);setSelected(0);setEditing(false);setMode('result');}else setMode('type');
  }finally{setBusy(false);setPhase('');}
 }
 async function commit(draft:Draft,start:boolean){setBusy(true);const result=await run(()=>draft.kind&&draft.kind!=='task'&&api.mode==='gateway'?request(api,'/captures/drafts/'+draft.id+'/park','POST',{}):api.commitDraft(draft,start));if(result)setSaved(previous=>[...previous,draft.id]);setBusy(false);}
 async function save(){setBusy(true);for(const draft of drafts){if(saved.includes(draft.id))continue;const result=await run(()=>draft.kind&&draft.kind!=='task'&&api.mode==='gateway'?request(api,'/captures/drafts/'+draft.id+'/park','POST',{}):api.commitDraft(draft,false));if(!result){setBusy(false);return;}setSaved(previous=>[...previous,draft.id]);}setBusy(false);onClose();}
 async function close(){if(voice.recording)await run(voice.stop);onClose();}
 return <Modal presentationStyle="fullScreen" animationType="fade" onRequestClose={()=>void close()}><View style={{flex:1,backgroundColor:c.bg}}><KeyboardAvoidingView behavior={Platform.OS==='web'?undefined:'padding'} style={{flex:1,backgroundColor:c.bg}}><Animated.View entering={calm?undefined:ZoomIn.duration(250)} style={{flex:1,maxWidth:460,width:'100%',alignSelf:'center',paddingTop:insets.top+14,paddingBottom:insets.bottom+22,paddingHorizontal:24}}>
 <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><IconButton name="x" label="Close brain dump" onPress={()=>void close()}/><Txt size={16} bold>Brain dump</Txt><View style={{width:44}}/></View>
 <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{flexGrow:1,justifyContent:'center',paddingTop:20,paddingBottom:20,gap:22}}>
 <View style={{alignItems:'center',gap:20}}><Avatar size={mode==='result'?54:96} state={busy?'think':voice.recording?'listen':'idle'} kind={state.settings.icon}/><Txt bold size={31} style={{textAlign:'center',maxWidth:330}}>{mode==='result'?'A little more room.':mode==='processing'?phase||'Making room…':mode==='voice'?'Tell me everything\non your mind.':'Get it out of your head.'}</Txt></View>
 {mode==='processing'?<View accessibilityRole="progressbar" accessibilityLabel={phase||'Making your plan'} style={{alignItems:'center',gap:12}}><Txt size={15} muted>Your thoughts stay here. One clear next step.</Txt></View>:mode==='type'?<Input accessibilityLabel="Brain dump" multiline value={text} onChangeText={setText} placeholder="The messy version is welcome…" style={{minHeight:150,maxHeight:240,lineHeight:25,fontSize:18,backgroundColor:c.card,borderRadius:24}}/>:mode==='voice'?<View style={{alignItems:'center',gap:16,paddingVertical:12}}>{voice.recording||voice.draft?<View style={{width:'100%',height:64,padding:12,backgroundColor:c.card,borderRadius:32,flexDirection:'row',alignItems:'center',gap:12}}><ComposerVoice recording={voice.recording} uri={voice.draft?.uri} duration={voice.recording?voice.duration:voice.draft?.duration||0} peaks={voice.recording?voice.peaks:voice.draft?.peaks||[]} onOptions={()=>{}} onError={message=>void run(async()=>{throw Error(message);})}/>{voice.recording&&<IconButton name="stop" label="Finish brain dump recording" disabled={voice.busy} onPress={()=>void run(voice.stop)} style={{width:40,height:40,backgroundColor:c.btn}} color={c.btnfg}/>}</View>:<Pressable accessibilityRole="button" accessibilityLabel="Start recording" disabled={voice.busy} onPress={()=>void run(voice.start)} style={{width:88,height:88,borderRadius:44,backgroundColor:c.btn,alignItems:'center',justifyContent:'center'}}><Icon name="mic" size={32} color={c.btnfg}/></Pressable>}{voice.draft?<Pressable accessibilityRole="button" onPress={voice.clear} style={{padding:10}}><Txt size={13} muted>Record again</Txt></Pressable>:!voice.recording&&<Txt size={14} muted>Say it as it comes.</Txt>}</View>:<View style={{gap:16}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Txt size={13} muted>{selected+1} / {drafts.length}</Txt><Pressable accessibilityRole="button" onPress={()=>setEditing(!editing)} style={{padding:8}}><Txt size={13}>{editing?'Done editing':'Edit'}</Txt></Pressable></View>{drafts.slice(selected,selected+1).map(draft=><Animated.View key={draft.id} entering={calm?undefined:FadeIn.duration(220)} style={{backgroundColor:c.card,borderRadius:26,padding:22,gap:15}}><Txt size={12} muted>{draft.kind==='idea'?'IDEA':draft.kind==='note'?'NOTE':'NEXT ACTION'}</Txt>{editing?<><Input accessibilityLabel="Plan item title" value={draft.title} onChangeText={title=>setDrafts(items=>items.map(item=>item.id===draft.id?{...item,title}:item))}/><Input accessibilityLabel="Plan item channel" value={draft.channel} onChangeText={channel=>setDrafts(items=>items.map(item=>item.id===draft.id?{...item,channel:channel.replace(/^#/,'')}:item))}/></>:<Txt size={24} bold>{draft.title}</Txt>}{!!draft.sub&&<Txt size={15} muted>{draft.sub}</Txt>}{saved.includes(draft.id)?<View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Icon name="done" color={c.ok}/><Txt size={14}>{draft.kind&&draft.kind!=='task'?'Parked':'Started'}</Txt></View>:<Button primary loading={busy} disabled={!draft.title.trim()||!draft.channel.trim()} onPress={()=>void commit(draft,true)}>{draft.kind&&draft.kind!=='task'?'Park idea':'Start this'}</Button>}</Animated.View>)}<View style={{flexDirection:'row',justifyContent:'space-between'}}><Button disabled={selected===0||busy} onPress={()=>{setSelected(selected-1);setEditing(false);}}>Previous</Button><Button disabled={selected===drafts.length-1||busy} onPress={()=>{setSelected(selected+1);setEditing(false);}}>Next</Button></View></View>}

 </ScrollView>
 {mode!=='processing'&&<View style={{gap:10}}>{mode==='result'?<><Button disabled={busy||drafts.some(d=>!d.title.trim()||!d.channel.trim())} onPress={()=>void save()}>{saved.length===drafts.length?'Done':'Keep the rest for later'}</Button><Pressable onPress={()=>setMode('type')} style={{padding:10,alignItems:'center'}}><Txt size={13} muted>Review original thoughts</Txt></Pressable></>:<><Button primary disabled={(!text.trim()&&!voice.draft)||voice.recording||voice.busy} onPress={()=>void collect()}>Make a plan</Button><Pressable disabled={voice.recording} onPress={()=>setMode(value=>value==='voice'?'type':'voice')} style={{padding:10,alignItems:'center'}}><Txt size={14} muted>{mode==='voice'?'Type instead':'Record instead'}</Txt></Pressable></>}</View>}

 {mode!=='result'&&mode!=='processing'&&!!history.value.length&&<><Button onPress={()=>setShowHistory(!showHistory)}>Previous brain dumps</Button>{showHistory&&<ScrollView style={{maxHeight:150}}>{history.value.map(capture=><Pressable key={capture.id} onPress={()=>{setText(capture.text);setMode('type');setShowHistory(false);}} style={{padding:12}}><Txt numberOfLines={2}>{capture.text}</Txt></Pressable>)}</ScrollView>}</>}
 {error&&<Toast message={error} error onClose={dismiss} top={60}/>}
 </Animated.View></KeyboardAvoidingView></View></Modal>;
}
