import React,{useState} from 'react';
import {markdownBlocks} from '../data/markdown';
import {View,ScrollView,Linking,Pressable} from 'react-native';
import {Txt} from './ui';
import {useTheme} from '../theme';
function Inline({text,color,onChannel}:{text:string;color:string;onChannel:(id:string)=>void}){
  const tokens=text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*]+\*|_[^_]+_|~~[^~]+~~|#[a-zA-Z0-9_-]+)/g);
  return <Txt selectable style={{color}}>{tokens.map((part,i)=>{
    const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if(link)return <Txt key={i} accessibilityRole="link" onPress={()=>void Linking.openURL(link[2]!)} style={{color,textDecorationLine:'underline'}}>{link[1]}</Txt>;
    if(part.startsWith('**')&&part.endsWith('**'))return <Txt key={i} bold style={{color}}>{part.slice(2,-2)}</Txt>;
    if(part.startsWith('`')&&part.endsWith('`'))return <Txt key={i} style={{color,fontFamily:'monospace',fontSize:14}}>{part.slice(1,-1)}</Txt>;
    if((part.startsWith('*')&&part.endsWith('*'))||(part.startsWith('_')&&part.endsWith('_')))return <Txt key={i} style={{color,fontStyle:'italic'}}>{part.slice(1,-1)}</Txt>;
    if(part.startsWith('~~')&&part.endsWith('~~'))return <Txt key={i} style={{color,textDecorationLine:'line-through'}}>{part.slice(2,-2)}</Txt>;
    if(/^#[a-zA-Z0-9_-]+$/.test(part))return <Txt key={i} accessibilityRole="button" bold onPress={()=>onChannel(part.slice(1).toLowerCase())} style={{color,textDecorationLine:'underline'}}>#{part.slice(1)}</Txt>;
    return part;
  })}</Txt>;
}
function MarkdownTable({columns,rows,color}:{columns:string[];rows:string[][];color:string}){
 const {c}=useTheme();const [page,setPage]=useState(0),size=5,total=Math.max(1,Math.ceil(rows.length/size));const current=Math.min(page,total-1),visible=rows.slice(current*size,(current+1)*size);
 const height=40+visible.length*60;
 return <View style={{maxWidth:'100%',minWidth:0,gap:6}}><ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={{height,flexGrow:0,flexShrink:0}} contentContainerStyle={{height,alignItems:'flex-start'}}><View style={{height}}><View style={{height:40,flexDirection:'row',backgroundColor:c.tile,borderRadius:10}}>{columns.map((column,i)=><View key={i} style={{width:150,height:40,padding:8,justifyContent:'center'}}><Txt bold size={12} numberOfLines={1} style={{color}}>{column}</Txt></View>)}</View>{visible.map((row,i)=><View key={current*size+i} style={{height:60,flexDirection:'row',borderBottomWidth:1,borderColor:c.line}}>{columns.map((_,j)=><View key={j} style={{width:150,height:60,padding:8,justifyContent:'center'}}><Txt size={13} numberOfLines={2} style={{color}}>{row[j]||''}</Txt></View>)}</View>)}</View></ScrollView>{total>1&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:36}}><Pressable accessibilityRole="button" disabled={!current} onPress={()=>setPage(current-1)} style={{padding:8,opacity:current?1:.3}}><Txt size={13}>Previous</Txt></Pressable><Txt size={12} muted>{current+1} / {total}</Txt><Pressable accessibilityRole="button" disabled={current>=total-1} onPress={()=>setPage(current+1)} style={{padding:8,opacity:current<total-1?1:.3}}><Txt size={13}>Next</Txt></Pressable></View>}</View>;
}
export function Markdown({text,color,onChannel}:{text:string;color:string;onChannel:(id:string)=>void}){
 const blocks=markdownBlocks(text);
 return <View style={{gap:5,maxWidth:'100%',minWidth:0}}>{blocks.map((b,i)=>{
  if(b.type==='table')return <MarkdownTable key={i} columns={b.columns} rows={b.rows} color={color}/>;
  if(b.type==='blank')return <View key={i} style={{height:5}}/>;
  if(b.type==='code')return <View key={i} style={{gap:5,paddingVertical:4,maxWidth:'100%'}}>{!!b.language&&<Txt size={11} style={{color,opacity:.65}}>{b.language}</Txt>}<ScrollView horizontal style={{flexGrow:0,maxHeight:240}}><Txt selectable size={13} style={{fontFamily:'monospace',lineHeight:20,color}}>{b.text}</Txt></ScrollView></View>;
  if(b.type==='heading')return <Txt key={i} size={19} bold style={{color,marginVertical:3}}>{b.text}</Txt>;
  const list=b.text.match(/^\s*(?:[-*+]\s+|(\d+)\.\s+)(.*)/);
  return list?<View key={i} style={{flexDirection:'row',gap:8}}><Txt style={{color}}>{list[1]?list[1]+'.':'•'}</Txt><View style={{flex:1,minWidth:0}}><Inline text={list[2]!} color={color} onChannel={onChannel}/></View></View>:<Inline key={i} text={b.text.replace(/^>\s?/,'')} color={color} onChannel={onChannel}/>;
 })}</View>;
}
