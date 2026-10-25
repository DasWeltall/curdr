import {useCallback,useEffect,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Message} from '../data/types';
import {PendingMessage,confirmedIds,restoreOutbox,serializeOutbox} from '../data/outbox';
export function useOutbox(scope:string,messages:Message[],onStorageError:()=>void){
 const [items,setItems]=useState<PendingMessage[]>([]),[loadedKey,setLoadedKey]=useState('');const current=useRef(messages),confirmed=useRef(new Set<string>()),storageError=useRef(false);
 current.current=messages;
 const writes=useRef<Promise<unknown>>(Promise.resolve());
 const key='curdr-outbox-v1:'+scope;const ready=loadedKey===key;
 useEffect(()=>{let active=true;setLoadedKey('');setItems([]);confirmed.current.clear();void AsyncStorage.getItem(key).then(raw=>{if(active){setItems(restoreOutbox(raw));setLoadedKey(key);}}).catch(()=>{if(active){setLoadedKey(key);onStorageError();}});return()=>{active=false;};},[key]);
 useEffect(()=>{setItems(previous=>{const ids=confirmedIds(previous,messages);for(const id of ids)confirmed.current.add(id);const remaining=previous.filter(item=>!ids.has(item.message.id));return remaining.length===previous.length?previous:remaining;});},[messages,ready]);
 useEffect(()=>{if(ready){const serialized=serializeOutbox(items);writes.current=writes.current.catch(()=>{}).then(()=>AsyncStorage.setItem(key,serialized)).catch(()=>{if(!storageError.current){storageError.current=true;onStorageError();}});}},[items,ready,key]);
 const add=useCallback((item:PendingMessage)=>setItems(previous=>[...previous.filter(x=>x.message.id!==item.message.id),item]),[]);
 const mark=useCallback((id:string,status:PendingMessage['status'])=>setItems(previous=>previous.map(x=>x.message.id===id?{...x,status}:x)),[]);
 const remove=useCallback((id:string)=>setItems(previous=>previous.filter(x=>x.message.id!==id)),[]);
 const isConfirmed=useCallback((id:string)=>confirmed.current.has(id)||current.current.some(m=>m.id===id),[]);
 return {items:ready?items:[],ready,add,mark,remove,isConfirmed};
}
