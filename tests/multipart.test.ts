import test from 'node:test';
import assert from 'node:assert/strict';
import {buildUploadForm,namedUploadFile,VOICE_LIMIT} from '../src/data/multipart';
import {readUploadFile} from '../src/data/uploadFile';
// Test against the installed Expo encoder that throws the reported exception.
import {convertFormDataAsync} from '../node_modules/expo/build/winter/fetch/convertFormData.js';
import {installFormDataPatch} from '../node_modules/expo/build/winter/FormData.js';

class NativeFormData { _parts:[string,unknown][]=[]; }
const ExpoFormData=installFormDataPatch(NativeFormData as unknown as typeof FormData);
async function withNativeFormData(run:()=>Promise<void>){
 const original=globalThis.FormData;
 globalThis.FormData=ExpoFormData as unknown as typeof FormData;
 try{await run();}finally{globalThis.FormData=original;}
}

test('reproduces Expo 58 rejection of the old URI-only native upload',async()=>{
 await withNativeFormData(async()=>{
  const old=new FormData();old.append('file',{uri:'file:///voice.m4a',name:'voice.m4a',type:'audio/mp4'} as unknown as Blob);
  await assert.rejects(convertFormDataAsync(old),/Unsupported FormDataPart implementation/);
 });
});

for(const sample of [
 {name:'voice-message.m4a',mimeType:'audio/mp4',fields:{duration:'2.4',channel:'launch',peaks:'[0,0.8,0.2]'}},
 {name:'brain-dump.m4a',mimeType:'audio/mp4',fields:{duration:'3.5'}},
 {name:'camera.jpg',mimeType:'image/jpeg',fields:{channel:'research'}},
 {name:'report.pdf',mimeType:'application/pdf',fields:{channel:'main'}},
])test(`native ${sample.name} sends actual bytes and metadata through Expo multipart`,async()=>{
 await withNativeFormData(async()=>{
  const bytes=new Uint8Array([0,65,255,13,10,66]);let reads=0;
  const source=new Blob([bytes]);
  const part=namedUploadFile({...source,size:source.size,type:'',arrayBuffer:()=>source.arrayBuffer(),bytes:async()=>{reads++;return bytes;},text:()=>source.text(),slice:(...args)=>source.slice(...args),stream:()=>source.stream()},sample.name,sample.mimeType);
  const upload={...sample,uri:'file:///cache/opaque-temp-id'};
  const form=await buildUploadForm(upload,sample.fields as Record<string,string>,()=>part);
  const {body,boundary}=await convertFormDataAsync(form,'curdr-regression-boundary');
  const decoded=await new Response(new Uint8Array(body).buffer,{headers:{'Content-Type':'multipart/form-data; boundary='+boundary}}).formData() as unknown as {get:(key:string)=>File|string|null};
  const file=decoded.get('file') as File;
  assert.equal(file.name,sample.name);assert.equal(file.type,sample.mimeType);
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()),bytes);
  for(const [key,value] of Object.entries(sample.fields))assert.equal(decoded.get(key),value);
  assert.equal(reads,1);assert.ok(!new TextDecoder().decode(body).includes('[object Object]'));
 });
});

test('browser File and camera blob URI preserve filename, MIME and bytes',async()=>{
 const file=new File(['browser audio'],'voice.webm',{type:'audio/webm'});
 const supplied={uri:'blob:not-needed',name:file.name,mimeType:file.type,file};
 const form=await buildUploadForm(supplied,{duration:'1.2'},readUploadFile);
 assert.equal((form.get('file') as File).name,'voice.webm');
 assert.equal(await (form.get('file') as File).text(),'browser audio');
 const uri=URL.createObjectURL(new Blob(['photo bytes'],{type:'image/jpeg'}));
 try{
  const camera=await buildUploadForm({uri,name:'photo.jpg',mimeType:'image/jpeg'},{channel:'main'},readUploadFile);
  assert.equal((camera.get('file') as File).name,'photo.jpg');
  assert.equal(await (camera.get('file') as File).text(),'photo bytes');
 }finally{URL.revokeObjectURL(uri);}
});

test('reject unreadable, empty and oversized voice files before sending',async()=>{
 const upload={uri:'file:///voice.m4a',name:'voice.m4a'};
 await assert.rejects(buildUploadForm(upload,{},()=>{throw Error('File no longer exists');}),/no longer exists/);
 await assert.rejects(buildUploadForm(upload,{},()=>new Blob([])),/empty or no longer available/);
 await assert.rejects(buildUploadForm(upload,{},()=>({size:VOICE_LIMIT+1} as Blob),VOICE_LIMIT),/recording smaller than 8 MB/);
});
