import type {Upload} from './types';
/** Browsers need actual Blob/File objects; camera captures may only have a blob URI. */
export async function readUploadFile(upload:Upload):Promise<Blob>{
 if(upload.file)return upload.file;
 const response=await fetch(upload.uri);
 if(!response.ok)throw Error('This file could not be read. Choose it again.');
 const blob=await response.blob();
 return new File([blob],upload.name,{type:upload.mimeType||blob.type||'application/octet-stream'});
}
