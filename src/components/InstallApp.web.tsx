import React,{useEffect,useState} from 'react';
import {View,Pressable} from 'react-native';
import {Button,Txt,Icon} from './ui';
import {useTheme} from '../theme';
interface InstallPrompt extends Event{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>;}
let pendingInstall:InstallPrompt|null=null;
let wasInstalled=false;
const installListeners=new Set<(prompt:InstallPrompt|null)=>void>();
if(typeof window!=='undefined'){
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pendingInstall=event as InstallPrompt;installListeners.forEach(listener=>listener(pendingInstall));});
 window.addEventListener('appinstalled',()=>{wasInstalled=true;pendingInstall=null;installListeners.forEach(listener=>listener(null));});
}
export function InstallApp(){const {c}=useTheme();const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[installed,setInstalled]=useState(false),[help,setHelp]=useState(false);useEffect(()=>{const standalone=()=>setInstalled(wasInstalled||window.matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);standalone();setPrompt(pendingInstall);const capture=(event:InstallPrompt|null)=>{setPrompt(event);standalone();};installListeners.add(capture);return()=>{installListeners.delete(capture);};},[]);async function install(){if(!prompt){setHelp(value=>!value);return;}try{await prompt.prompt();await prompt.userChoice;}catch{setHelp(true);}finally{pendingInstall=null;setPrompt(null);}}return <View style={{gap:14,paddingVertical:16}}><Button onPress={()=>void install()} disabled={installed}>{installed?'Installed':'Install curdr'}</Button>{help&&!installed&&<View style={{gap:12,padding:16,borderRadius:20,backgroundColor:c.tile}}><Txt bold>Keep curdr on your home screen.</Txt><Txt size={14}>Android: open your browser menu and choose “Install app” or “Add to Home screen”.</Txt><Txt size={14}>iPhone: open in Safari, tap Share, then “Add to Home Screen” and enable “Open as Web App”.</Txt><Txt size={14}>The app uses the same connected Hermes workspace as this website.</Txt></View>}</View>;}
