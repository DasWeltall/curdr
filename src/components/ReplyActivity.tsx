import React,{useState} from 'react';
import {Pressable,View} from 'react-native';
import {AgentRun} from '../data/types';
import {useTheme} from '../theme';
import {Txt,Icon} from './ui';
import {TypingDots} from './TypingDots';
import {Sheet} from './Sheet';
import {RunStatus} from './RunStatus';
export function ReplyActivity({run,sending}:{run?:AgentRun;sending?:boolean}){
 const {c}=useTheme();const [open,setOpen]=useState(false);const label=run?.status==='waiting'?'Needs your input':run?.detail||(sending?'Sending':'Waiting for Hermes');
 return <><Pressable accessibilityRole="button" accessibilityLabel={run?'View agent activity':'Waiting for Hermes'} disabled={!run} onPress={()=>setOpen(true)} style={{alignSelf:'flex-start',maxWidth:'100%',minHeight:42,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,paddingVertical:10,borderRadius:21,backgroundColor:c.ai}}><TypingDots inline/><Txt size={13} numberOfLines={1} style={{flexShrink:1}}>{label}</Txt>{!!run&&<Icon name="chev" size={13}/>}</Pressable>{open&&run&&<Sheet title="Activity" onClose={()=>setOpen(false)}><View style={{paddingBottom:16}}><RunStatus run={run} expanded/></View></Sheet>}</>;
}
