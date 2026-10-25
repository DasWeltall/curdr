import React,{useRef,useState} from 'react';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import {RangeProps,SliderVisual} from './SliderVisual';
export function RangeSlider(props:RangeProps){const [active,setActive]=useState(false);const previous=useRef(props.value);return <SliderVisual {...props} active={active}><Slider accessibilityLabel={props.label} accessibilityValue={{min:props.min,max:props.max,now:props.value}} minimumValue={props.min} maximumValue={props.max} value={props.value} step={props.step||1} onSlidingStart={()=>setActive(true)} onSlidingComplete={()=>setActive(false)} onValueChange={value=>{if(value!==previous.current&&Math.round(value)%5===0)void Haptics.selectionAsync().catch(()=>{});previous.current=value;props.onChange(value);}} style={{position:'absolute',inset:0,width:'100%',height:52,opacity:0}}/></SliderVisual>;}
