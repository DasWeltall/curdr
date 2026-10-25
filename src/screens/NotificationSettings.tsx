import React,{useEffect,useState} from 'react';
import {View,Platform,DeviceEventEmitter} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useStore} from '../data/store';
import {request} from '../data/workspace';
import {Button,Txt} from '../components/ui';
import {pushSetup,requestPush} from '../notifications/device';
import {PUSH_KEY} from '../notifications/PushBridge';
export function NotificationSettings(){
 const {api,run}=useStore();const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[server,setServer]=useState<boolean|null>(null);
 useEffect(()=>{void AsyncStorage.getItem(PUSH_KEY).then(value=>setEnabled(!!value));if(api.mode==='gateway')void request(api,'/notifications').then(value=>setServer(value.enabled)).catch(()=>setServer(false));},[api]);
 const missing=pushSetup();
 async function enable(){setBusy(true);await run(async()=>{const token=await requestPush();const previous=await AsyncStorage.getItem(PUSH_KEY);const id=previous?JSON.parse(previous).id:'device-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);await request(api,'/notifications/devices','POST',{id,token,active:true});await AsyncStorage.setItem(PUSH_KEY,JSON.stringify({id,token}));setEnabled(true);DeviceEventEmitter.emit('curdr-push-changed');});setBusy(false);}
 async function disable(){setBusy(true);await run(async()=>{const raw=await AsyncStorage.getItem(PUSH_KEY);if(raw&&api.mode==='gateway')await request(api,'/notifications/devices/'+JSON.parse(raw).id+'/remove','POST',{});await AsyncStorage.removeItem(PUSH_KEY);setEnabled(false);DeviceEventEmitter.emit('curdr-push-changed');});setBusy(false);}
 return <View style={{gap:12,paddingVertical:16}}><Txt size={14}>Decisions and useful results, with quiet hours and sleep respected. Message content stays out of notifications.</Txt>{!!missing&&<Txt size={13} muted>{missing}</Txt>}{!missing&&server===false&&<Txt size={13}>Enable CURDR_PUSH_ENABLED on your gateway after configuring push credentials.</Txt>}{Platform.OS!=='web'&&<Button loading={busy} disabled={!enabled&&(!!missing||server!==true||api.mode!=='gateway')} onPress={()=>void(enabled?disable():enable())}>{enabled?'Turn off notifications':'Enable notifications'}</Button>}</View>;
}
