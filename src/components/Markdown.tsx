import React from 'react';
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
export function Markdown({text,color,onChannel}:{text:string;color:string;onChannel:(id:string)=>void}){
  const {c}=useTheme();const lines=text.split('\n');const blocks:React.ReactNode[]=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i]!;
    if(line.startsWith('```')){const language=line.slice(3),code=[];while(++i<lines.length&&!lines[i]!.startsWith('```'))code.push(lines[i]);blocks.push(<View key={i} style={{gap:5,paddingVertical:4}}>{!!language&&<Txt size={11} style={{color,opacity:.65}}>{language}</Txt>}<ScrollView horizontal><Txt selectable size={13} style={{fontFamily:'monospace',lineHeight:20,color}}>{code.join('\n')}</Txt></ScrollView></View>);continue;}
    const heading=line.match(/^#{1,4}\s+(.+)/);if(heading){blocks.push(<Txt key={i} size={19} bold style={{color,marginVertical:3}}>{heading[1]}</Txt>);continue;}
    const list=line.match(/^\s*(?:[-*+]\s+|(\d+)\.\s+)(.*)/);if(list){blocks.push(<View key={i} style={{flexDirection:'row',gap:8}}><Txt style={{color}}>{list[1]?list[1]+'.':'•'}</Txt><View style={{flex:1}}><Inline text={list[2]!} color={color} onChannel={onChannel}/></View></View>);continue;}
    if(!line.trim()){if(blocks.length)blocks.push(<View key={i} style={{height:8}}/>);continue;}
    if(line.trim().startsWith('|')){const rows=[line];while(i+1<lines.length&&lines[i+1]!.trim().startsWith('|'))rows.push(lines[++i]!);blocks.push(<ScrollView horizontal key={i}><View>{rows.filter(row=>!/^\|?[\s:|\-]+\|?$/.test(row)).map((row,r)=><View key={r} style={{flexDirection:'row',borderBottomWidth:1,borderColor:color+'33'}}>{row.trim().replace(/^\||\|$/g,'').split('|').map((cell,j)=><View key={j} style={{width:140,padding:8}}><Txt bold={r===0} size={14} style={{color}}>{cell.trim()}</Txt></View>)}</View>)}</View></ScrollView>);continue;}
    blocks.push(<Inline key={i} text={line.replace(/^>\s?/,'')} color={color} onChannel={onChannel}/>);
  }
  return <View style={{gap:5,maxWidth:'100%'}}>{blocks}</View>;
}
