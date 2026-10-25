import React,{useEffect} from 'react';
import {View} from 'react-native';
import Animated,{useSharedValue,useAnimatedStyle,withRepeat,withSequence,withTiming,withDelay,cancelAnimation} from 'react-native-reanimated';
import {useTheme} from '../theme';
function Dot({index}:{index:number}){const {c,calm}=useTheme();const progress=useSharedValue(0);useEffect(()=>{if(!calm)progress.value=withDelay(index*130,withRepeat(withSequence(withTiming(1,{duration:280}),withTiming(0,{duration:280}),withTiming(0,{duration:300})),-1));return()=>cancelAnimation(progress);},[calm]);const style=useAnimatedStyle(()=>({opacity:.35+.65*progress.value,transform:[{translateY:-5*progress.value},{scale:.85+.15*progress.value}]}));return <Animated.View style={[{width:7,height:7,borderRadius:4,backgroundColor:c.ink},style]}/>;}
export function TypingDots(){const {c}=useTheme();return <View accessible accessibilityLabel="Waiting for a reply" style={{alignSelf:'flex-start',flexDirection:'row',gap:5,paddingHorizontal:18,paddingVertical:18,borderRadius:22,backgroundColor:c.ai}}>{[0,1,2].map(index=><Dot key={index} index={index}/>)}</View>;}
