import React,{useState} from 'react';
import {View} from 'react-native';
import {useTheme} from '../theme';
import {useStore} from '../data/store';
import {messageInk} from '../data/messageColors';
import {Sheet} from '../components/Sheet';
import {ColorPicker} from '../components/ColorPicker';
import {Txt,Button,Segments} from '../components/ui';
export function MessageColors({onClose}:{onClose:()=>void}){
 const {c}=useTheme();const {state,api,run}=useStore();const [mine,setMine]=useState(state.settings.userMessageColor||c.me),[agent,setAgent]=useState(state.settings.agentMessageColor||c.ai),[target,setTarget]=useState('mine'),[busy,setBusy]=useState(false);
 async function save(reset=false){setBusy(true);const ok=await run(async()=>{await api.settings({userMessageColor:reset?'':mine,agentMessageColor:reset?'':agent});return true;});setBusy(false);if(ok)onClose();}
 return <Sheet title="Message colors" onClose={onClose}><View style={{gap:22}}>
 <View style={{padding:18,borderRadius:27,backgroundColor:c.bg,gap:12}}><View style={{alignSelf:'flex-end',backgroundColor:mine,padding:15,borderRadius:23,maxWidth:'90%'}}><Txt style={{color:messageInk(mine)}}>A little more like me.</Txt></View><View style={{alignSelf:'flex-start',backgroundColor:agent,padding:15,borderRadius:23,maxWidth:'90%'}}><Txt style={{color:messageInk(agent)}}>Make yourself at home.</Txt></View></View>
 <Segments value={target} options={[["mine","Your messages"],["agent","Assistant"]]} onChange={setTarget}/>
 <ColorPicker value={target==='mine'?mine:agent} onChange={target==='mine'?setMine:setAgent}/>
 <Button primary loading={busy} onPress={()=>void save()}>Save colors</Button><Button disabled={busy} onPress={()=>void save(true)}>Use theme colors</Button>
 </View></Sheet>;
}
