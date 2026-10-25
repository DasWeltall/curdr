import React from 'react';
import { View,Pressable } from 'react-native';
import Animated,{FadeIn,FadeOut} from 'react-native-reanimated';
import {useTheme} from '../theme';
import {Txt,Icon} from './ui';
/** Routine saves are quiet. Only actionable errors interrupt the screen. */
export function Toast({message,error,onClose,top}:{message:string;error:boolean;onClose:()=>void;top:number}){const {c,calm}=useTheme();if(!error)return null;return <Animated.View entering={calm?undefined:FadeIn.duration(140)} exiting={calm?undefined:FadeOut.duration(120)} accessibilityRole="alert" style={{position:'absolute',top,left:20,right:20,zIndex:90,backgroundColor:c.card,borderRadius:18,padding:14,flexDirection:'row',alignItems:'center',gap:10,shadowColor:'#000',shadowOpacity:.08,shadowRadius:16,shadowOffset:{width:0,height:5}}}><View style={{width:4,alignSelf:'stretch',borderRadius:2,backgroundColor:c.amb}}/><Txt size={14} style={{flex:1}}>{message}</Txt><Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={onClose} style={{width:32,height:32,justifyContent:'center',alignItems:'center'}}><Icon name="x" size={17}/></Pressable></Animated.View>;}
