import {Platform} from 'react-native';
import {readUploadFile} from './uploadFile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalTransport } from './local';
import { AgentEvent, Draft, OutputFile, Settings, Task, TaskAction, Upload, VoiceUpload, uid } from './types';
import { reduce } from './reducer';
import { channelId, mentions } from './channels';
import { File as DeviceFile } from 'expo-file-system';
export class DemoTransport extends LocalTransport {
  override mode = 'demo' as const;
  autoPlay = false;
  private generation = 0;
  private waiters = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private stopped = false;
  private playing = false;
  private channelSummaries = {
    launch: 'Own the launch plan. Audience: students. Keep the first release small; no paid ads.',
    research: 'Find useful evidence and turn it into short, source-aware recommendations.',
  };
  constructor(settings?: Settings) { super(settings); if (settings) this.state.settings = {...this.state.settings,...settings,sleeping:false}; }
  private emit(event: AgentEvent) { this.state = reduce(this.state, event); this.listener?.(event); }
  private later(callback: () => void, ms: number) { const id = setTimeout(() => { this.timers.delete(id); if (!this.stopped) callback(); }, ms); this.timers.add(id); }
  private text(text: string, channel = 'main', role: 'user' | 'agent' = 'agent') { this.emit({type:'message',data:{id:uid(),role,kind:'text',text,channel,createdAt:new Date().toISOString()}}); }
  override connect(onEvent: (event: AgentEvent) => void, onStatus: (status: string) => void) {
    this.listener = onEvent; this.stopped = false;
    onEvent({type:'snapshot',data:this.state}); onStatus('Demo'); if (this.autoPlay) { this.autoPlay=false; this.demoControl('play'); }
    return () => { this.stopped = true; this.waiters.forEach(resolve=>resolve()); this.waiters.clear(); this.timers.forEach(clearTimeout); this.timers.clear(); this.listener = undefined; };
  }
  override async settings(patch: Partial<Settings>) { if(patch.sleeping)this.demoControl('pause');this.emit({type:'settings',data:{...this.state.settings,...patch}}); await AsyncStorage.setItem('curdr-demo-preferences-v5',JSON.stringify(this.state.settings)); }
  override async channel(id: string, context: string) {
    id = channelId(id); if (!id || id === 'main') throw Error('Choose a channel name.');
    this.emit({type:'channels',data:[...this.state.channels.filter(c => c.id !== id),{id,name:id,context,summary:'',createdAt:new Date().toISOString()}]});
  }
  override async visual(fileId:string,block:number,change:{value?:number;item?:number;done?:boolean}) {
    const file=this.state.files.find(file=>file.id===fileId);if(!file?.content)throw Error('Visualization not found.');
    const visual=JSON.parse(file.content),target=visual.blocks[block];
    if(target?.type==='calculator'&&typeof change.value==='number')target.value=Math.min(target.max,Math.max(target.min,change.value));
    else if(target?.type==='checklist'&&typeof change.item==='number'&&typeof change.done==='boolean'&&target.items[change.item])target.items[change.item].done=change.done;
    else throw Error('This control cannot be changed.');
    this.emit({type:'file_added',data:{...file,content:JSON.stringify(visual),updatedAt:new Date().toISOString()}});
  }
  override async transcribe(_file: VoiceUpload): Promise<string> { throw Error('Voice transcription requires a connected Hermes server. Your recording is ready to preview.'); }
  override async message(text: string, channel = 'main', attachments?: string[]) {
    if(this.state.settings.sleeping)throw Error('Your assistant is resting. Wake it in Settings to continue.');
    const generation=this.generation;
    if (attachments?.length) this.emit({type:'message',data:{id:uid(),role:'user',kind:'attachment',fileIds:attachments,text,channel,createdAt:new Date().toISOString()}});
    else this.text(text,channel,'user');
    this.emit({type:'activity',data:{channel,state:'think'}});
    const targets = channel === 'main' ? mentions(text) : [];
    for (const target of targets) if (!this.state.channels.some(c => c.id === target)) await this.channel(target, this.channelSummaries[target as keyof typeof this.channelSummaries] || text);
    await new Promise<void>(resolve => { this.waiters.add(resolve); this.later(()=>{this.waiters.delete(resolve);resolve();},1300); });
    if (this.stopped || generation!==this.generation) return;
    for (const target of targets) {
      this.text(`Main chat handed off: ${text}`,target,'user');
      this.text(target === 'launch' ? 'I kept the plan focused: one landing-page promise, one short product clip, and five personal feedback conversations. No ads and no broad launch.' : 'I will keep the evidence and working notes here, separate from the launch conversation.',target);
      const existing = this.state.channels.find(c => c.id === target)!;
      this.emit({type:'channels',data:this.state.channels.map(c => c.id === target ? {...existing,summary:'A focused first-release plan is ready for review.'} : c)});
    }
    if (channel === 'main') {
      const task: Task = {id:uid(),title:targets.length ? 'Review the focused launch plan' : 'Review your next step',channel:targets[0] || 'launch',status:'review',source:'chat',summary:'A short plan is ready for your review.',updatedAt:new Date().toISOString()};
      if (!this.state.channels.some(c => c.id === task.channel)) await this.channel(task.channel,this.channelSummaries.launch);
      this.emit({type:'task_update',data:task});
      const visual={title:'A smaller launch.',description:'An interactive plan. Try the slider and check off the next steps.',blocks:[{type:'metrics',items:[{label:'Goal',value:'1 release'},{label:'Feedback',value:'5 people'},{label:'Ads',value:'$0'}]},{type:'calculator',label:'Feedback conversations',min:1,max:20,step:1,value:5,multiplier:15,offset:0,unit:'',resultLabel:'Minutes to set aside'},{type:'checklist',items:[{text:'Write one clear product promise.',done:false},{text:'Record a 20-second product clip.',done:false},{text:'Ask five people for feedback.',done:false}]}]};
      const f:OutputFile={id:uid(),name:'launch-plan.curdr.json',channel:task.channel,content:JSON.stringify(visual),mime:'application/vnd.curdr.visual+json',updatedAt:new Date().toISOString()};
      this.emit({type:'file_added',data:f});
      await this.streamPreview(targets.length?`I handed this to #${targets[0]}. Here’s a focused plan to explore.`:'Start small. Here’s an interactive plan you can adjust.',channel,generation);
      if(this.stopped||generation!==this.generation)return;
      this.emit({type:'message',data:{id:uid(),role:'agent',kind:'artifact',channel:'main',title:visual.title,description:visual.description,fileId:f.id,createdAt:new Date().toISOString()}});
    } else {
      const context = this.state.channels.find(c => c.id === channel)?.context;
      this.text(`For #${channel}, I’m keeping this brief in mind: ${context || 'a focused conversation'}.\n\nNext: choose the smallest useful deliverable, define what “done” means, and review it before taking action.`,channel);
    }
    if(channel==='main'){const id=uid();this.emit({type:'approval',data:{id,taskId:'',kind:'tool',title:'Demo · review an action',body:'Preview a one-time approval. This walkthrough does not execute commands.',command:'Write launch-notes.md in the shared workspace',expiresAt:new Date(Date.now()+3600000).toISOString(),state:'pending'}});this.emit({type:'message',data:{id:uid(),role:'agent',kind:'approval',approvalId:id,channel,createdAt:new Date().toISOString()}});}
    this.emit({type:'activity',data:{channel,state:'idle'}});
  }
  override async braindump(text: string): Promise<Draft[]> { return text.split(/\n|;/).filter(s => s.trim()).slice(0,12).map(s => ({id:uid(),title:s.trim(),sub:'Review before starting.',channel:mentions(s)[0] || 'launch'})); }
  override async commitDraft(draft: Draft, start: boolean): Promise<Task> { const task: Task = {...draft,status:start?'review':'up',source:'chat',summary:start?'Demo result ready to review.':'Ready when you are.',updatedAt:new Date().toISOString()}; this.emit({type:'task_update',data:task}); return task; }
  override async task(id: string, action: TaskAction, text?: string) { const t=this.state.tasks.find(t=>t.id===id); if(!t)return; if(action==='delete') { this.emit({type:'task_removed',data:{id}}); return; } this.emit({type:'task_update',data:{...t,status:action==='done'?'done':action==='start'?'run':'up',summary:text || (action==='done'?'Completed.':'Updated.'),updatedAt:new Date().toISOString()}}); }
  override async approval(id:string,decision:'approve'|'later'|'session'|'always') {
    const approval=this.state.approvals.find(a=>a.id===id);
    if(!approval||approval.state!=='pending')throw Error('This request was already handled.');
    this.emit({type:'approval',data:{...approval,state:decision!=='later'?'approved':'denied'}});
    this.text(decision!=='later'?'Demo decision recorded. In a connected workspace, this approves only that specific Hermes action.':'Demo action denied. Nothing was executed.');
  }
  private wait(ms:number) { return new Promise<void>(resolve=>{this.waiters.add(resolve);this.later(()=>{this.waiters.delete(resolve);resolve();},ms);}); }
  private async streamPreview(text:string,channel:string,generation:number) {
    const id=uid(),runId='demo-'+uid(),at=new Date().toISOString();
    const run={id:runId,channel,status:'working',detail:'Reviewing the launch brief',startedAt:at,updatedAt:at,activities:[{id:'brief',type:'tool.started',title:'Read channel context',detail:'Using the brief in #launch.',at}]};
    this.emit({type:'run',data:run});
    this.emit({type:'skills',data:[{id:'demo-plan',title:'Launch planning',source:'Demo',description:'A staged skill preview. Connected mode loads the actual skills installed on your Hermes host.',enabled:true,readOnly:true}]});
    await this.wait(500);
    const words=text.split(' ');let output='';
    for(const word of words){
      if(this.stopped||generation!==this.generation)return;
      output+=(output?' ':'')+word;
      this.emit({type:'message',data:{id,role:'agent',kind:'text',text:output,channel,createdAt:at,streaming:true,runId}});
      this.emit({type:'run',data:{...run,status:'responding',detail:'Writing a reply',updatedAt:new Date().toISOString()}});
      await this.wait(60);
    }
    if(this.stopped||generation!==this.generation)return;
    this.emit({type:'message',data:{id,role:'agent',kind:'text',text,channel,createdAt:at,streaming:false,runId}});
    this.emit({type:'run',data:{...run,status:'completed',detail:'Completed',updatedAt:new Date().toISOString(),activities:run.activities.map(a=>({...a,type:'tool.completed'}))}});
  }
  override async upload(file: Upload): Promise<OutputFile> {
    let base64='';
    const blob=Platform.OS==='web'?await readUploadFile(file):file.file;
    if(blob) base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(blob);});
    else base64=await new DeviceFile(file.uri).base64();
    const result: OutputFile={id:uid(),name:file.name,channel:file.channel||'main',mime:file.mimeType||'application/octet-stream',base64,updatedAt:new Date().toISOString()};
    this.emit({type:'file_added',data:result}); return result;
  }
  override async audio(file: VoiceUpload) { const item=await this.upload(file);this.emit({type:'message',data:{id:uid(),role:'user',kind:'audio',fileId:item.id,duration:file.duration,peaks:file.peaks,channel:file.channel||'main',createdAt:new Date().toISOString()}});this.text('Your recording is attached and playable. Live transcription runs on your connected Hermes host; the demo does not invent a transcript.',file.channel||'main'); }
  demoControl = (action: 'play' | 'pause' | 'restart') => {
    if(action==='pause') {this.generation++; this.waiters.forEach(resolve=>resolve());this.waiters.clear();this.timers.forEach(clearTimeout);this.timers.clear();this.playing=false;for(const item of this.state.runs||[])if(!['completed','cancelled'].includes(item.status))this.emit({type:'run',data:{...item,status:'cancelled',detail:'Walkthrough paused'}});for(const m of this.state.messages)if(m.streaming)this.emit({type:'message',data:{...m,streaming:false}});this.emit({type:'activity',data:{channel:'main',state:'idle'}});return;}
    if(action==='restart') {this.generation++; this.waiters.forEach(resolve=>resolve());this.waiters.clear();this.timers.forEach(clearTimeout);this.timers.clear();this.state={...this.state,tasks:[],messages:[],channels:[],files:[],logs:[],approvals:[],runs:[],skills:[],iconState:'idle'};this.emit({type:'snapshot',data:this.state});this.playing=false;}
    if(this.playing)return;
    this.playing=true;
    this.later(()=>{void this.message('Help me plan a small launch with #launch. Keep it focused and don’t spend on ads.').finally(()=>{this.playing=false;});},300);
  };
}
