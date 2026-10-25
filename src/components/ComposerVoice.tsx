import React,{useMemo} from 'react';
import {View,Pressable,ActivityIndicator} from 'react-native';
import {useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {useTheme} from '../theme';
import {Icon} from './ui';
import {Waveform} from './Waveform';
import {audioTime} from '../data/audio';
export function ComposerVoice({recording,uri,peaks,duration,onOptions,onError}:{recording:boolean;uri?:string;peaks:number[];duration:number;onOptions:()=>void;onError:(message:string)=>void}){
 const {c}=useTheme();const source=useMemo(()=>uri?{uri}:null,[uri]);const player=useAudioPlayer(source,{updateInterval:100});const status=useAudioPlayerStatus(player);
 async function play(){try{if(status.playing)player.pause();else{if(status.didJustFinish)await player.seekTo(0);player.play();}}catch{onError('This recording could not be played.');}}
 return <Pressable accessibilityRole="button" accessibilityLabel={recording?'Recording, '+audioTime(duration):'Voice message ready, '+audioTime(duration)} accessibilityHint="Hold for recording options" onLongPress={onOptions} delayLongPress={450} style={{flex:1,minWidth:0,height:40,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:4}}>
 {recording?<View style={{width:9,height:9,borderRadius:5,backgroundColor:'#E45D69',marginHorizontal:8}}/>:<Pressable accessibilityRole="button" accessibilityLabel={status.playing?'Pause recording preview':'Play recording preview'} disabled={!status.isLoaded} onPress={()=>void play()} style={{height:34,width:34,borderRadius:17,backgroundColor:c.btn,alignItems:'center',justifyContent:'center',flexShrink:0}}>{!status.isLoaded?<ActivityIndicator size="small" color={c.btnfg}/>:<Icon name={status.playing?'pause':'play'} size={16} color={c.btnfg}/>}</Pressable>}
 <View style={{flex:1,minWidth:0,overflow:'hidden'}}><Waveform height={28} live={recording} peaks={peaks} progress={status.duration?status.currentTime/status.duration:0} onSeek={!recording&&status.isLoaded?fraction=>{void player.seekTo(fraction*(status.duration||duration)).catch(()=>onError('This recording could not be played.'));}:undefined}/></View>
 </Pressable>;
}
