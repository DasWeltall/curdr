import React from 'react';
import {View,Pressable} from 'react-native';
import {useTheme} from '../theme';
import {Status,channelStatus} from '../data/types';
import {useStore} from '../data/store';
import {Txt,Icon} from './ui';
export function StatusIcon({status}:{status:Status}){const {c}=useTheme();return <View style={{width:7,height:7,borderRadius:4,backgroundColor:status==='need'?c.amb:status==='run'?c.acc:status==='review'?c.ok:c.mute}}/>;}
export function Channel({name,onPress,inline=false}:{name:string;onPress:()=>void;inline?:boolean}){const {c}=useTheme();const {state}=useStore();return <Pressable accessibilityRole="button" accessibilityLabel={`Open #${name}`} onPress={onPress} hitSlop={10} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,minHeight:23,marginLeft:inline?0:3,marginBottom:inline?0:3,paddingHorizontal:inline?7:1,paddingVertical:2,borderRadius:8,backgroundColor:inline?c.tile:'transparent'}}><StatusIcon status={channelStatus(state.tasks,name)}/><Txt size={12} bold style={{color:c.mute}}>{name==='main'?'Main':`#${name}`}</Txt></Pressable>;}
