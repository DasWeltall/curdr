import React, { useEffect, useState } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Text,
  TextProps,
  Pressable,
  View,
  StyleProp,
  ViewStyle,
  TextInput,
  TextInputProps,
  ActivityIndicator,
} from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useTheme } from "../theme";
export const paths = {
  plus: "M12 5v14M5 12h14",
  mic: "M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6M5 11a7 7 0 0 0 14 0M12 18v3",
  wave: "M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4",
  chat: "M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-6.5A7.5 7.5 0 0 1 10.5 4H16a4 4 0 0 1 4 4v3.5M8 10h8M8 14h5",
  tasks: "M4 6l2 2 3.5-3.5M4 15l2 2 3.5-3.5M13 7h7M13 16h7",
  comp: "M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 20h8M12 16v4",
  chev: "M9 5l7 7-7 7",
  down: "M6 9l6 6 6-6",
  copy: "M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2",
  edit: "M4 20l1-4L16 5l3 3L8 19zM14 7l3 3",
  reply: "M5 5v6a3 3 0 0 0 3 3h10M14 10l4 4-4 4",
  done: "M5 12l5 5 9-10",
  need: "M12 6v7M12 17.5v.5",
  run: "M18 12a6 6 0 1 1-2-4.5",
  review: "M5 12l5 5 9-10",
  up: "M5 12h14M14 7l5 5-5 5",
  back: "M15 5l-7 7 7 7",
  send: "M12 19V5M5 12l7-7 7 7",
  mail: "M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3M4 8l8 5 8-5",
  cal: "M7 5h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3M4 10h16M9 3v4M15 3v4",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  x: "M6 6l12 12M18 6L6 18",
  kbd: "M6 6h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3M7 10h.01M11 10h.01M15 10h.01M8 14h8",
  search: "M16 16l4 4",
  sort: "M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3",
  person: "M5 20v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7",
  camera: "M8 5l1-2h6l1 2h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  photo: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M3 16l5-5 4 4 3-3 6 6M15 7h.01",
  play: "M8 5l11 7-11 7V5",
  pause: "M8 5v14M16 5v14",
  stop: "M6 6h12v12H6z",
  replay: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
  hash: "M10 3L8 21M17 3l-2 18M4 8h17M3 16h17",
  sparkle: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 22,
  color,
  width = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: string;
  width?: number;
}) {
  const { c } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? c.ink}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name==='play'?<Path d="M8 5.7c0-1 1.1-1.6 1.9-1.1l10 6.3c.9.5.9 1.7 0 2.2l-10 6.3c-.8.5-1.9-.1-1.9-1.1Z" fill={color??c.ink} stroke="none"/>:name==='pause'?<><Rect x={6} y={5} width={4} height={14} rx={1.6} fill={color??c.ink} stroke="none"/><Rect x={14} y={5} width={4} height={14} rx={1.6} fill={color??c.ink} stroke="none"/></>:name==='stop'?<Rect x={6} y={6} width={12} height={12} rx={3} fill={color??c.ink} stroke="none"/>:<Path d={paths[name]} />}
      {name === "search" && <Circle cx={11} cy={11} r={6.5} />}

    </Svg>
  );
}
export function Txt({
  style,
  serif = false,
  muted = false,
  size = 16,
  bold = false,
  ...props
}: TextProps & {
  serif?: boolean;
  muted?: boolean;
  size?: number;
  bold?: boolean;
}) {
  const { c, fs } = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: serif
            ? "Gabarito_600SemiBold"
            : bold
              ? "Gabarito_600SemiBold"
              : "Gabarito_400Regular",
          fontSize: size * fs,
          lineHeight: size * fs * (serif ? 1.15 : 1.4),
          color: muted ? c.mute : c.ink,
        },
        style,
      ]}
    />
  );
}
export function IconButton({
  name,
  onPress,
  label,
  color,
  style,
  disabled = false,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 44,
          width: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
export function Button({
  children,
  label,
  onPress,
  primary = false,
  disabled = false,
  loading = false,
  style,
}: {
  children: React.ReactNode;
  label?: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label ?? (typeof children === "string" ? children : undefined)
      }
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 999,
          borderWidth: 0,
          backgroundColor: primary ? c.btn : c.tile,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? c.btnfg : c.ink} />
      ) : typeof children !== "string" ? (
        children
      ) : (
        <Txt
          bold
          style={{ color: primary ? c.btnfg : c.ink, textAlign: "center" }}
        >
          {children}
        </Txt>
      )}
    </Pressable>
  );
}
export function Input({ style, ...props }: TextInputProps) {
  const { c, fs } = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={c.mute}
      selectionColor={c.acc}
      style={[
        {
          minHeight: 48,
          backgroundColor: c.tile,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontFamily: "Gabarito_400Regular",
          fontSize: 16 * fs,
          color: c.ink,
        },
        style,
      ]}
    />
  );
}
export function Toggle({ value, onChange, label, disabled = false }: { value: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  const { c, calm } = useTheme();
  const progress=useSharedValue(value?1:0), pressed=useSharedValue(0);
  useEffect(()=>{progress.value=calm?(value?1:0):withSpring(value?1:0,{damping:19,stiffness:260});},[value,calm]);
  const knob=useAnimatedStyle(()=>({transform:[{translateX:progress.value*20},{scaleX:1+pressed.value*.12}],opacity:1}));
  return <Pressable accessibilityRole="switch" aria-checked={value} accessibilityLabel={label} accessibilityState={{checked:value,disabled}} disabled={disabled} onPressIn={()=>{pressed.value=withTiming(1,{duration:100});}} onPressOut={()=>{pressed.value=withTiming(0,{duration:160});}} onPress={()=>{void Haptics.selectionAsync().catch(()=>{});onChange(!value);}} style={{minWidth:52,minHeight:44,alignItems:'center',justifyContent:'center',opacity:disabled ? .5 : 1}}>
    <View style={{width:50,height:30,padding:3,borderRadius:20,backgroundColor:value?c.acc:c.line}}><Animated.View style={[{height:24,width:24,borderRadius:12,backgroundColor:'#fff',shadowColor:'#000',shadowOpacity:.14,shadowRadius:3,shadowOffset:{width:0,height:2},elevation:2},knob]} /></View>
  </Pressable>;
}
export function Segments<T extends string|number>({value,options,onChange}:{value:T;options:[T,string][];onChange:(v:T)=>void}){
 const {c,calm}=useTheme();const [width,setWidth]=useState(0);const x=useSharedValue(0);const index=Math.max(0,options.findIndex(([v])=>v===value)),slot=(width-6)/options.length;
 useEffect(()=>{x.value=calm?index*slot:withSpring(index*slot,{damping:22,stiffness:240});},[index,slot,calm]);const indicator=useAnimatedStyle(()=>({transform:[{translateX:x.value}]}));
 return <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={{flexDirection:'row',padding:3,backgroundColor:c.tile,borderRadius:17}}>{width>6&&<Animated.View pointerEvents="none" style={[{position:'absolute',left:3,top:3,bottom:3,width:slot,borderRadius:14,backgroundColor:c.card},indicator]}/>} {options.map(([v,label])=><Pressable key={v} accessibilityRole="tab" aria-selected={value===v} accessibilityState={{selected:value===v}} onPress={()=>onChange(v)} style={{flex:1,minHeight:44,paddingHorizontal:4,justifyContent:'center',alignItems:'center'}}><Txt size={options.length>3?12:14} bold={value===v} style={{textAlign:'center',color:value===v?c.ink:c.mute}}>{label}</Txt></Pressable>)}</View>;
}
export const shadow = {
  shadowColor: "#141412",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 2,
};
