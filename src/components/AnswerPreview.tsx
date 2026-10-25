import React,{useState} from 'react';
import {View,ScrollView} from 'react-native';
import {useTheme} from '../theme';
import {replyExcerpt} from '../data/chatLayout';
import {Txt,Button,Icon} from './ui';
import {Markdown} from './Markdown';
import {Sheet} from './Sheet';
import {saveText} from '../files';
import {useStore} from '../data/store';
/** A compact document preview for oversized replies; original content is retained. */
export function AnswerPreview({text,onChannel}:{text:string;onChannel:(id:string)=>void}){
 const {c}=useTheme();const {run}=useStore();const [open,setOpen]=useState(false),[page,setPage]=useState(0);const pages=Math.max(1,Math.ceil(text.length/12000));
 return <><View style={{width:'100%',maxWidth:360,padding:16,gap:12,borderRadius:23,backgroundColor:c.card}}><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Icon name="file" size={18}/><Txt bold size={15}>Details</Txt></View><Txt size={15}>{replyExcerpt(text)}</Txt><Button onPress={()=>setOpen(true)}>Open answer</Button></View>{open&&<Sheet scroll={false} title="Details" onClose={()=>setOpen(false)}><ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:24}}><Markdown text={text.slice(page*12000,(page+1)*12000)} color={c.ink} onChannel={onChannel}/></ScrollView>{pages>1&&<View style={{flexDirection:'row',alignItems:'center',gap:10}}><Button disabled={!page} onPress={()=>setPage(page-1)}>Previous</Button><Txt size={12}>{page+1} / {pages}</Txt><Button disabled={page===pages-1} onPress={()=>setPage(page+1)}>Next</Button></View>}<Button onPress={()=>void run(()=>saveText('answer.md',text,'text/markdown'))}>Save answer</Button></Sheet>}</>;
}
