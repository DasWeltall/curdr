import React,{useEffect,useRef,useState} from 'react';
import {Animated,View,Platform,Easing,AccessibilityInfo} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {useTheme} from '../theme';
const petals=['M48 21C24 21 20 43 39 48C45 50 48 43 48 37Z','M75 48C75 24 53 20 48 39C46 45 53 48 59 48Z','M48 75C72 75 76 53 57 48C51 46 48 53 48 59Z','M21 48C21 72 43 76 48 57C50 51 43 48 37 48Z'];
export function CurdrMark({size=96}:{size?:number}){return <Svg width={size} height={size} viewBox="0 0 96 96">{petals.map((d,i)=><Path key={i} d={d} fill={['#C5DCA9','#E3EBCB','#D9B99B','#9EB792'][i]}/>)}<Path d="M48 42a6 6 0 1 1 0 12 6 6 0 0 1 0-12" fill="#F8F9F5"/></Svg>;}
/** A single short entrance, with a static reduced-motion equivalent. */
export function ParticleSplash(){
 const {c,calm}=useTheme();const [visible,setVisible]=useState(true);const progress=useRef(new Animated.Value(0)).current;
 useEffect(()=>{let disposed=false;let animation:Animated.CompositeAnimation|undefined;
  void AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{if(disposed)return;animation=Animated.timing(progress,{toValue:1,duration:calm||reduced?120:1050,easing:Easing.bezier(.2,.8,.2,1),useNativeDriver:Platform.OS!=='web'});animation.start(({finished})=>{if(finished&&!disposed)setVisible(false);});});
  return()=>{disposed=true;animation?.stop();};
 },[]);
 if(!visible)return null;
 return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',inset:0,zIndex:10000,backgroundColor:c.bg,justifyContent:'center',alignItems:'center',opacity:progress.interpolate({inputRange:[0,.82,1],outputRange:[1,1,0]})}}>
  <Animated.View style={{opacity:progress.interpolate({inputRange:[0,.3,.7,1],outputRange:[0,0,1,1]}),transform:[{scale:progress.interpolate({inputRange:[0,1],outputRange:[.88,1]})}]}}><CurdrMark size={112}/></Animated.View>
  {!calm&&Array.from({length:40},(_,i)=>{const angle=i*2.399963,spread=100+(i%9)*17,petal=i%4,a=petal*Math.PI/2,t=(i%10)/10*Math.PI*2,tx=Math.cos(a)*18+Math.cos(t)*10,ty=Math.sin(a)*18+Math.sin(t)*10;return <Animated.View key={i} style={{position:'absolute',left:'50%',top:'50%',width:3+(i%3),height:3+(i%3),borderRadius:5,backgroundColor:['#A0B78D','#D9B99B','#C5DCA9'][i%3],opacity:progress.interpolate({inputRange:[0,.12,.55,.78,1],outputRange:[0,.8,.8,0,0]}),transform:[{translateX:progress.interpolate({inputRange:[0,.7,1],outputRange:[Math.cos(angle)*spread,tx,tx]})},{translateY:progress.interpolate({inputRange:[0,.7,1],outputRange:[Math.sin(angle)*spread,ty,ty]})}]}}/>;})}
 </Animated.View>;
}
