import type {Upload} from './types';
export const MEDIA_LIMIT=10*1024*1024;
export const VOICE_LIMIT=8*1024*1024;
export type UploadReader=(upload:Upload)=>Blob|Promise<Blob>;

/** Real Blob interface with the user's filename/MIME, including Expo File.bytes().
 * Expo's default fetch does NOT support React Native's old {uri,name,type} parts.
 */
export function namedUploadFile(source:Blob,name:string,type:string):Blob&{name:string}{
 return {
  name,type:type||source.type||'application/octet-stream',size:source.size,
  bytes:async()=>typeof source.bytes==='function'?source.bytes():new Uint8Array(await source.arrayBuffer()),
  arrayBuffer:()=>source.arrayBuffer(),text:()=>source.text(),
  slice:(start,end,contentType)=>source.slice(start,end,contentType),stream:()=>source.stream(),
 };
}

export async function buildUploadForm(upload:Upload,fields:Record<string,string>,read:UploadReader,limit=MEDIA_LIMIT){
 const part=await read(upload);
 if(!Number.isFinite(part.size)||part.size<=0)throw Error('This file is empty or no longer available. Choose it again.');
 if(part.size>limit)throw Error(`Choose a ${limit===VOICE_LIMIT?'recording':'file'} smaller than ${limit/1024/1024} MB.`);
 const form=new FormData();
 form.append('file',part,upload.name);
 for(const [key,value] of Object.entries(fields))form.append(key,value);
 // Let fetch generate Content-Type and the matching multipart boundary.
 return form;
}
