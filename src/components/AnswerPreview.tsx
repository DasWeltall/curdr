import React,{useState} from 'react';
import {View,Pressable,ScrollView} from 'react-native';
import {useTheme} from '../theme';
import {Markdown} from './Markdown';
import {Txt,Icon} from './ui';
/** Expand in place. Keep the full response without a document/save detour. */
export function AnswerPreview({text,onChannel}:{text:string;onChannel:(id:string)=>void}){
 const {c}=useTheme();const [expanded,setExpanded]=useState(false);
 return <View style={{maxWidth:'100%',width:360,padding:16,gap:10,borderRadius:23,backgroundColor:c.ai}}>
 <View style={{maxHeight:expanded?560:164,overflow:'hidden'}}>{expanded?<ScrollView nestedScrollEnabled style={{maxHeight:560,flexGrow:0}}><Markdown text={text} color={c.aiInk} onChannel={onChannel}/></ScrollView>:<Markdown text={text.slice(0,1400)} color={c.aiInk} onChannel={onChannel}/>}</View>
 <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={{minHeight:36,flexDirection:'row',alignItems:'center',gap:8}}><Txt bold size={13}>{expanded?'Show less':'Continue reading'}</Txt><Icon name={expanded?'up':'down'} size={14}/></Pressable>
 </View>;
}
