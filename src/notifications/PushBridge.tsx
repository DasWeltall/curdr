import React,{useEffect} from 'react';
import {AppState,DeviceEventEmitter,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRouter} from 'expo-router';
import {useStore} from '../data/store';
import {request} from '../data/workspace';
import {listenForPush} from './device';
export const PUSH_KEY='curdr-push-device-v1';
export function PushBridge(){
 const {api,hydrated}=useStore();const router=useRouter();
 useEffect(()=>{if(Platform.OS==='web'||!hydrated||api.mode!=='gateway')return;return listenForPush(target=>{if(target.channel&&/^[a-z0-9_-]{1,48}$/.test(target.channel))router.replace({pathname:'/',params:{channel:target.channel}});});},[api,hydrated]);
 useEffect(()=>{
  if(Platform.OS==='web'||api.mode!=='gateway')return;
  let disposed=false,device:{id:string;token:string}|null=null,registered=false;
  const sync=async()=>{const raw=await AsyncStorage.getItem(PUSH_KEY);if(!raw){if(device)await request(api,'/notifications/devices/'+device.id+'/remove','POST',{}).catch(()=>{});device=null;registered=false;return;}device=JSON.parse(raw);if(disposed||!device)return;try{await request(api,'/notifications/devices','POST',{...device,active:AppState.currentState==='active'});registered=true;}catch{registered=false;}};
  const presence=()=>{if(device&&registered)void request(api,'/notifications/devices/'+device.id+'/presence','POST',{active:AppState.currentState==='active'}).catch(()=>{});};
  void sync();const interval=setInterval(presence,25000),app=AppState.addEventListener('change',presence),changes=DeviceEventEmitter.addListener('curdr-push-changed',()=>void sync());
  return()=>{disposed=true;clearInterval(interval);app.remove();changes.remove();if(device)void request(api,'/notifications/devices/'+device.id+'/remove','POST',{}).catch(()=>{});};
 },[api]);
 return null;
}
