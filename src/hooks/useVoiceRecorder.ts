import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { levelFromDb, MAX_PEAKS, summarizePeaks } from '../data/audio';
import { VoiceUpload } from '../data/types';
export function useVoiceRecorder() {
  const recorder=useAudioRecorder({...RecordingPresets.HIGH_QUALITY,isMeteringEnabled:true});
  const status=useAudioRecorderState(recorder,100);
  const [draft,setDraft]=useState<VoiceUpload|null>(null),[busy,setBusy]=useState(false),[recordingError,setRecordingError]=useState('');
  const stopping=useRef(false);
  const started=useRef(0);
  const samples=useRef<number[]>([]);const [peaks,setPeaks]=useState<number[]>([]);
  useEffect(()=>{if(status.isRecording){samples.current=[...samples.current,levelFromDb(status.metering)].slice(-MAX_PEAKS);setPeaks(samples.current);}},[status.durationMillis,status.isRecording,status.metering]);
  async function start() {
    if(busy || status.isRecording)return;
    setBusy(true);setRecordingError('');
    try {
      const permission=await AudioModule.requestRecordingPermissionsAsync();
      if(!permission.granted)throw Error('Microphone access is needed to record a voice message.');
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
      samples.current=[];setPeaks([]);
      await recorder.prepareToRecordAsync(); recorder.record(); started.current=Date.now(); setDraft(null);
    } finally {setBusy(false);}
  }
  async function stop() {
    if(stopping.current)return;
    stopping.current=true;setBusy(true);
    try {
      await recorder.stop();
      const uri=recorder.uri;
      if(!uri)throw Error('The recording could not be saved.');
      const duration=Math.max(.1,Math.min(120,(Date.now()-started.current)/1000));
      let file:File|undefined,mimeType='audio/mp4',name='voice-message.m4a';
      if(Platform.OS==='web'){
        const blob=await (await fetch(uri)).blob();
        mimeType=blob.type||'audio/webm';
        name='voice-message.'+(mimeType.includes('mp4')?'m4a':mimeType.includes('ogg')?'ogg':'webm');
        file=new File([blob],name,{type:mimeType});
      }
      if(duration<.3)throw Error('Record a little longer to save a voice message.');
      setDraft({uri,name,mimeType,file,duration,peaks:summarizePeaks(samples.current,160)});
    } finally {await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true}).catch(()=>{});stopping.current=false;setBusy(false);}
  }
  useEffect(()=>{if(status.isRecording&&status.durationMillis>=120000)void stop().catch(error=>setRecordingError(error instanceof Error?error.message:'The recording could not be saved.'));},[status.durationMillis,status.isRecording]);
  return {recording:status.isRecording,duration:status.durationMillis/1000,metering:status.metering,peaks,busy,draft,recordingError,start,stop,clear:()=>setDraft(null)};
}
