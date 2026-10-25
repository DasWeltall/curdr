import {File as LocalFile} from 'expo-file-system';
import type {Upload} from './types';
import {namedUploadFile} from './multipart';
/** FileSystem File implements Blob.bytes(), supported by Expo 58's fetch encoder. */
export function readUploadFile(upload:Upload):Blob{
 const source=upload.file??new LocalFile(upload.uri);
 return namedUploadFile(source,upload.name,upload.mimeType||source.type);
}
