import React,{useState} from 'react';
import {View,Pressable} from 'react-native';
import {useStore} from '../data/store';
import {useTheme} from '../theme';
import {parseVisual} from '../data/visual';
import {saveOutput} from '../files';
import {VisualView} from './VisualView';
import {Sheet} from './Sheet';
import {Txt,Icon,Button} from './ui';
export function ArtifactCard({fileId,title,description}:{fileId:string;title:string;description?:string}){const {state,api,run}=useStore();const {c}=useTheme();const file=state.files.find(f=>f.id===fileId),visual=parseVisual(file?.content);return <View style={{width:'100%',padding:16,gap:12,backgroundColor:c.card,borderRadius:24,borderWidth:1,borderColor:c.line}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Txt bold size={19} style={{flex:1}}>{title}</Txt><Pressable accessibilityRole="button" accessibilityLabel={'Save '+title} onPress={()=>{if(file)void run(()=>saveOutput(file));}} style={{padding:6}}><Icon name="file" size={17}/></Pressable></View>{!!description&&<Txt size={13} muted>{description}</Txt>}{visual?<VisualView visual={visual} compact onChange={(block,change)=>void run(()=>api.visual(fileId,block,change))}/>:<Txt>Preview unavailable.</Txt>}</View>;}
