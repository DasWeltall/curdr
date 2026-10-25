import type {Message,VoiceUpload} from './types';
export interface PendingMessage {message:Message;status:'sending'|'failed'|'unknown';baseline:string[];voice?:VoiceUpload;}
export function acknowledged(item:PendingMessage,messages:Message[]){
 return messages.some(m=>m.id===item.message.id||(!item.baseline.includes(m.id)&&m.role==='user'&&(m.channel||'main')===(item.message.channel||'main')&&(
  m.kind==='text'&&item.message.kind==='text'&&m.text===item.message.text||
  m.kind==='attachment'&&item.message.kind==='attachment'&&m.text===item.message.text&&m.fileIds.join()===item.message.fileIds.join()||
  m.kind==='audio'&&item.message.kind==='audio'&&Math.abs(m.duration-item.message.duration)<.2
 )));
}
export function confirmedIds(items:PendingMessage[],messages:Message[]){
 const confirmed=new Set<string>(),used=new Set<string>();
 for(const item of items){const exact=messages.find(m=>m.id===item.message.id);if(exact){confirmed.add(item.message.id);used.add(exact.id);}}
 for(const item of items){if(confirmed.has(item.message.id))continue;const match=messages.find(m=>!used.has(m.id)&&acknowledged(item,[m]));if(match){confirmed.add(item.message.id);used.add(match.id);}}
 return confirmed;
}
export function pendingMessages(items:PendingMessage[],messages:Message[]){const confirmed=confirmedIds(items,messages);return items.filter(item=>!confirmed.has(item.message.id)).map(item=>({...item.message,delivery:item.status}));}
export function serializeOutbox(items:PendingMessage[]){return JSON.stringify(items.map(item=>{if(!item.voice)return item;const {file,...voice}=item.voice;return {...item,voice};}));}
export function restoreOutbox(raw:string|null):PendingMessage[]{
 try{return (JSON.parse(raw||'[]') as PendingMessage[]).filter(i=>i?.message?.role==='user'&&typeof i.message.id==='string'&&i.message.id.startsWith('u-')&&Array.isArray(i.baseline)).slice(-20).map(i=>({...i,status:'unknown'}));}catch{return [];}
}
